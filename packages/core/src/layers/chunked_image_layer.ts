import { Layer, LayerOptions, RenderContext } from "../core/layer";
import type { IdetikContext } from "../idetik";
import {
  Chunk,
  ChunkSource,
  SliceCoordinates,
  getSlicePosition,
  getOrientation,
  ChunkDataConstructor,
} from "../data/chunk";
import { ChunkStore } from "../core/chunk_store";
import { ChunkStoreView, INTERNAL_POLICY_KEY } from "../core/chunk_store_view";
import { ImageSourcePolicy } from "../core/image_source_policy";
import { ChannelProps, ChannelsEnabled } from "../objects/textures/channel";
import { ImageRenderable } from "../objects/renderable/image_renderable";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import { Logger } from "../utilities/logger";
import { Color } from "../core/color";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3, quat } from "gl-matrix";
import { handlePointPickingEvent, PointPickingResult } from "./point_picking";
import { almostEqual } from "../utilities/almost_equal";
import { clamp } from "../utilities/clamp";
import { RenderablePool } from "../utilities/renderable_pool";

const VOLUME_NOT_SUPPORTED_ERROR =
  "Volume rendering not supported. Use VolumeLayer for volume rendering.";

export type ChunkedImageLayerProps = LayerOptions & {
  source: ChunkSource;
  sliceCoords: SliceCoordinates;
  policy: ImageSourcePolicy;
  channelProps?: ChannelProps[];
  onPickValue?: (info: PointPickingResult) => void;
};

export class ChunkedImageLayer extends Layer implements ChannelsEnabled {
  public readonly type = "ChunkedImageLayer";

  private readonly source_: ChunkSource;
  private readonly sliceCoords_: SliceCoordinates;
  private readonly onPickValue_?: (info: PointPickingResult) => void;
  private readonly visibleChunks_: Map<Chunk, ImageRenderable> = new Map();
  private readonly pool_ = new RenderablePool<ImageRenderable>();
  private readonly initialChannelProps_?: ChannelProps[];
  private readonly channelChangeCallbacks_: (() => void)[] = [];
  private policy_: ImageSourcePolicy;
  private channelProps_?: ChannelProps[];
  private chunkStoreView_?: ChunkStoreView;
  private pointerDownPos_: vec2 | null = null;
  private prevSlicePosition_?: number;
  private debugMode_ = false;

  private static readonly STALE_PRESENTATION_MS_ = 1000;
  private lastPresentationTimeStamp_?: DOMHighResTimeStamp;
  private lastPresentationTimeCoord_?: number;

  private readonly wireframeColors_ = [
    new Color(0.6, 0.3, 0.3),
    new Color(0.3, 0.6, 0.4),
    new Color(0.4, 0.4, 0.7),
    new Color(0.6, 0.5, 0.3),
  ];

  constructor({
    source,
    sliceCoords,
    policy,
    channelProps,
    onPickValue,
    ...layerOptions
  }: ChunkedImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.policy_ = policy;
    this.sliceCoords_ = sliceCoords;
    this.channelProps_ = channelProps;
    this.initialChannelProps_ = channelProps;
    this.onPickValue_ = onPickValue;
  }

  public async onAttached(context: IdetikContext) {
    if (this.chunkStoreView_) {
      throw new Error(
        "ChunkedImageLayer cannot be attached to multiple contexts simultaneously."
      );
    }
    this.chunkStoreView_ = await context.chunkManager.addView(
      this.source_,
      this.policy_
    );
  }

  public onDetached(context: IdetikContext): void {
    this.releaseAndRemoveChunks(this.visibleChunks_.keys());
    this.clearObjects();
    if (!this.chunkStoreView_) return;
    context.chunkManager.removeView(this.chunkStoreView_);
    this.chunkStoreView_ = undefined;
  }

  public update(context?: RenderContext) {
    if (!context || !this.chunkStoreView_) return;

    this.chunkStoreView_.updateChunkStates(this.sliceCoords_, context.viewport);

    this.updateChunks();
    this.resliceIfCoordinateChanged();
  }

  private updateChunks() {
    if (!this.chunkStoreView_) return;
    if (this.state !== "ready") this.setState("ready");

    if (
      this.visibleChunks_.size > 0 &&
      !this.chunkStoreView_.allVisibleLowestLODLoaded(this.sliceCoords_) &&
      !this.isPresentationStale()
    ) {
      return;
    }
    this.lastPresentationTimeStamp_ = performance.now();
    this.lastPresentationTimeCoord_ = this.sliceCoords_.t;

    const orderedByLOD = this.chunkStoreView_.getChunksToRender(
      this.sliceCoords_
    );
    const current = new Set(orderedByLOD);
    const nonVisibleChunks = Array.from(this.visibleChunks_.keys()).filter(
      (chunk) => !current.has(chunk)
    );
    this.releaseAndRemoveChunks(nonVisibleChunks);

    this.clearObjects();
    for (const chunk of orderedByLOD) {
      if (chunk.state !== "loaded") continue;
      const image = this.getImageForChunk(chunk);
      this.visibleChunks_.set(chunk, image);
      this.addObject(image);
    }
  }

  public get lastPresentationTimeCoord(): number | undefined {
    return this.lastPresentationTimeCoord_;
  }

  private isPresentationStale(): boolean {
    if (this.lastPresentationTimeStamp_ === undefined) return false;
    return (
      performance.now() - this.lastPresentationTimeStamp_ >
      ChunkedImageLayer.STALE_PRESENTATION_MS_
    );
  }

  private resliceIfCoordinateChanged() {
    const slicePosition = getSlicePosition(this.sliceCoords_);
    if (
      slicePosition === undefined ||
      this.prevSlicePosition_ === slicePosition
    ) {
      return;
    }

    const orientation = getOrientation(this.sliceCoords_);
    if (orientation === "volume") {
      throw new Error(VOLUME_NOT_SUPPORTED_ERROR);
    }
    for (const [chunk, image] of this.visibleChunks_) {
      if (chunk.state !== "loaded" || !chunk.data) continue;
      const data = this.slicePlane(chunk, slicePosition);
      if (data) {
        const texture = image.textures[0] as Texture2DArray;
        texture.updateWithChunk(chunk, data, orientation);
        // Update the position to match the new slice
        this.updateImageChunk(image, chunk);
      }
    }

    this.prevSlicePosition_ = slicePosition;
  }

  public onEvent(event: EventContext) {
    this.pointerDownPos_ = handlePointPickingEvent(
      event,
      this.pointerDownPos_,
      (world) => this.getValueAtWorld(world),
      this.onPickValue_
    );
  }

  public get chunkStore(): ChunkStore | undefined {
    return this.chunkStoreView_?.store;
  }

  public get chunkStoreView(): ChunkStoreView | undefined {
    return this.chunkStoreView_;
  }

  public get sliceCoords(): SliceCoordinates {
    return this.sliceCoords_;
  }

  public get source(): ChunkSource {
    return this.source_;
  }

  public get imageSourcePolicy(): Readonly<ImageSourcePolicy> {
    return this.policy_;
  }

  public set imageSourcePolicy(newPolicy: ImageSourcePolicy) {
    if (this.policy_ !== newPolicy) {
      this.policy_ = newPolicy;
      if (this.chunkStoreView_) {
        this.chunkStoreView_.setImageSourcePolicy(
          newPolicy,
          INTERNAL_POLICY_KEY
        );
      }
    }
  }

  private slicePlane(chunk: Chunk, sliceValue: number) {
    if (!chunk.data) return;

    const orientation = getOrientation(this.sliceCoords_);

    switch (orientation) {
      case "xy": {
        const zLocal = (sliceValue - chunk.offset.z) / chunk.scale.z;
        const zIdx = Math.round(zLocal);
        const zClamped = clamp(zIdx, 0, chunk.shape.z - 1);

        // Treat values within ~1 voxel (plus tiny floating-point error) as OK.
        if (!almostEqual(zLocal, zClamped, 1 + 1e-6)) {
          Logger.error("ImageLayer", "slicePlane value outside extent");
        }

        const sliceSize = chunk.shape.x * chunk.shape.y;
        const offset = sliceSize * zClamped;
        return chunk.data.slice(offset, offset + sliceSize);
      }

      case "xz": {
        const yLocal = (sliceValue - chunk.offset.y) / chunk.scale.y;
        const yIdx = Math.round(yLocal);
        const yClamped = clamp(yIdx, 0, chunk.shape.y - 1);

        if (!almostEqual(yLocal, yClamped, 1 + 1e-6)) {
          Logger.error("ImageLayer", "slicePlane value outside extent");
        }

        const sliceSize = chunk.shape.x * chunk.shape.z;
        const result = new (chunk.data.constructor as ChunkDataConstructor)(
          sliceSize
        );
        const rowSize = chunk.shape.x;
        const xyPlaneSize = chunk.shape.x * chunk.shape.y;

        for (let z = 0; z < chunk.shape.z; z++) {
          const srcOffset = z * xyPlaneSize + yClamped * rowSize;
          const dstOffset = z * rowSize;
          for (let x = 0; x < chunk.shape.x; x++) {
            result[dstOffset + x] = chunk.data[srcOffset + x];
          }
        }
        return result;
      }

      case "yz": {
        const xLocal = (sliceValue - chunk.offset.x) / chunk.scale.x;
        const xIdx = Math.round(xLocal);
        const xClamped = clamp(xIdx, 0, chunk.shape.x - 1);

        if (!almostEqual(xLocal, xClamped, 1 + 1e-6)) {
          Logger.error("ImageLayer", "slicePlane value outside extent");
        }

        const sliceSize = chunk.shape.y * chunk.shape.z;
        const result = new (chunk.data.constructor as ChunkDataConstructor)(
          sliceSize
        );
        const rowSize = chunk.shape.x;
        const xyPlaneSize = chunk.shape.x * chunk.shape.y;

        // Output data with Z varying fast (width) and Y varying slow (height)
        // so that after rotateY(-90°), Z maps to world Z and Y maps to world Y
        for (let y = 0; y < chunk.shape.y; y++) {
          for (let z = 0; z < chunk.shape.z; z++) {
            const srcOffset = z * xyPlaneSize + y * rowSize + xClamped;
            const dstOffset = y * chunk.shape.z + z;
            result[dstOffset] = chunk.data[srcOffset];
          }
        }
        return result;
      }

      case "volume":
        throw new Error(VOLUME_NOT_SUPPORTED_ERROR);
    }
  }

  private getImageForChunk(chunk: Chunk) {
    const existing = this.visibleChunks_.get(chunk);
    if (existing) return existing;

    const orientation = getOrientation(this.sliceCoords_);
    if (orientation === "volume") {
      throw new Error(VOLUME_NOT_SUPPORTED_ERROR);
    }
    const pooled = this.pool_.acquire(poolKeyForImageRenderable(chunk));
    if (pooled) {
      const texture = pooled.textures[0] as Texture2DArray;
      texture.updateWithChunk(chunk, this.getDataForImage(chunk), orientation);
      this.updateImageChunk(pooled, chunk);
      if (this.channelProps_) {
        pooled.setChannelProps(this.channelProps_);
      }
      return pooled;
    }

    return this.createImage(chunk);
  }

  private createImage(chunk: Chunk) {
    const orientation = getOrientation(this.sliceCoords_);

    if (orientation === "volume") {
      throw new Error(VOLUME_NOT_SUPPORTED_ERROR);
    }

    const data = this.getDataForImage(chunk);
    if (!data) {
      throw new Error("No data available for image");
    }

    const texture = Texture2DArray.createWithChunk(chunk, data, orientation);

    const image = new ImageRenderable(
      texture.width,
      texture.height,
      texture,
      this.channelProps_ ?? [{}]
    );
    this.updateImageChunk(image, chunk);
    return image;
  }

  private getDataForImage(chunk: Chunk) {
    const slicePosition = getSlicePosition(this.sliceCoords_);
    const data =
      slicePosition !== undefined
        ? this.slicePlane(chunk, slicePosition)
        : chunk.data;
    if (!data) {
      Logger.warn("ChunkedImageLayer", "No data for image");
      return;
    }
    return data;
  }

  private updateImageChunk(image: ImageRenderable, chunk: Chunk) {
    if (this.debugMode_) {
      image.wireframeEnabled = true;
      image.wireframeColor =
        this.wireframeColors_[chunk.lod % this.wireframeColors_.length];
    } else {
      image.wireframeEnabled = false;
    }

    const orientation = getOrientation(this.sliceCoords_);
    const slicePosition = getSlicePosition(this.sliceCoords_) ?? 0;

    switch (orientation) {
      case "xy":
        image.transform.setScale(vec3.fromValues(chunk.scale.x, chunk.scale.y, 1));
        image.transform.setTranslation(
          vec3.fromValues(chunk.offset.x, chunk.offset.y, slicePosition)
        );
        image.transform.setRotation(quat.create());
        break;

      case "xz": {
        image.transform.setScale(vec3.fromValues(chunk.scale.x, chunk.scale.z, 1));
        image.transform.setTranslation(
          vec3.fromValues(chunk.offset.x, slicePosition, chunk.offset.z)
        );
        const rotation = quat.create();
        quat.rotateX(rotation, rotation, Math.PI / 2);
        image.transform.setRotation(rotation);
        break;
      }

      case "yz": {
        // Texture has width=Z, height=Y to match rotateY(-90°) transformation
        image.transform.setScale(vec3.fromValues(chunk.scale.z, chunk.scale.y, 1));
        image.transform.setTranslation(
          vec3.fromValues(slicePosition, chunk.offset.y, chunk.offset.z)
        );
        const rotation = quat.create();
        quat.rotateY(rotation, rotation, -Math.PI / 2);
        image.transform.setRotation(rotation);
        break;
      }

      case "volume":
        throw new Error(VOLUME_NOT_SUPPORTED_ERROR);
    }
  }

  public getValueAtWorld(world: vec3): number | null {
    const currentLOD = this.chunkStoreView_?.currentLOD ?? 0;

    // First, try to find the value in current LOD chunks (highest priority)
    for (const [chunk, image] of this.visibleChunks_) {
      if (chunk.lod !== currentLOD) continue;
      const value = this.getValueFromChunk(chunk, image, world);
      if (value !== null) return value;
    }

    // Fallback to low-res chunks if no current LOD chunk contains the position
    for (const [chunk, image] of this.visibleChunks_) {
      if (chunk.lod === currentLOD) continue;
      const value = this.getValueFromChunk(chunk, image, world);
      if (value !== null) return value;
    }

    return null;
  }

  private getValueFromChunk(
    chunk: Chunk,
    image: ImageRenderable,
    world: vec3
  ): number | null {
    if (!chunk.data) return null;

    const localPos = vec3.transformMat4(
      vec3.create(),
      world,
      image.transform.inverse
    );

    const x = Math.floor(localPos[0]);
    const y = Math.floor(localPos[1]);

    // Check if this chunk contains the requested position
    if (x >= 0 && x < chunk.shape.x && y >= 0 && y < chunk.shape.y) {
      const data =
        this.sliceCoords_.z !== undefined
          ? this.slicePlane(chunk, this.sliceCoords_.z)!
          : chunk.data;
      const pixelIndex = y * chunk.rowStride + x;

      // For multi-channel images, take the first channel value
      return data[pixelIndex];
    }

    return null;
  }

  public get debugMode(): boolean {
    return this.debugMode_;
  }

  public set debugMode(debug: boolean) {
    this.debugMode_ = debug;
    this.visibleChunks_.forEach((image, chunk) => {
      image.wireframeEnabled = this.debugMode_;
      if (this.debugMode_) {
        image.wireframeColor =
          this.wireframeColors_[chunk.lod % this.wireframeColors_.length];
      }
    });
  }

  public get channelProps(): ChannelProps[] | undefined {
    return this.channelProps_;
  }

  public setChannelProps(channelProps: ChannelProps[]) {
    this.channelProps_ = channelProps;
    this.visibleChunks_.forEach((image) => {
      image.setChannelProps(channelProps);
    });
    this.channelChangeCallbacks_.forEach((callback) => {
      callback();
    });
  }

  public resetChannelProps(): void {
    if (this.initialChannelProps_ !== undefined) {
      this.setChannelProps(this.initialChannelProps_);
    }
  }

  public addChannelChangeCallback(callback: () => void): void {
    this.channelChangeCallbacks_.push(callback);
  }

  public removeChannelChangeCallback(callback: () => void): void {
    const index = this.channelChangeCallbacks_.indexOf(callback);
    if (index === -1) {
      throw new Error(`Callback to remove could not be found: ${callback}`);
    }
    this.channelChangeCallbacks_.splice(index, 1);
  }

  private releaseAndRemoveChunks(chunks: Iterable<Chunk>): void {
    for (const chunk of chunks) {
      const image = this.visibleChunks_.get(chunk);
      if (image) {
        this.pool_.release(poolKeyForImageRenderable(chunk), image);
        this.visibleChunks_.delete(chunk);
      }
    }
  }
}

export function poolKeyForImageRenderable(chunk: Chunk) {
  return [
    `lod${chunk.lod}`,
    `shape${chunk.shape.x}x${chunk.shape.y}x${chunk.shape.z}`,
    `stride${chunk.rowStride}`,
    `align${chunk.rowAlignmentBytes}`,
  ].join(":");
}
