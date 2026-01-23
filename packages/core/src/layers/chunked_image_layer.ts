import { Layer, LayerOptions, RenderContext } from "../core/layer";
import type { IdetikContext } from "../idetik";
import { Chunk, ChunkSource, ChunkDataConstructor } from "../data/chunk";
import {
  SliceCoordinates,
  getSlicePosition,
  getSliceScale,
  getSliceTranslation,
  getSliceRotation,
  getTextureDimensions,
  isAxisAlignedSlice,
} from "../data/slice_coordinates";
import { ChunkStoreView, INTERNAL_POLICY_KEY } from "../core/chunk_store_view";
import { ImageSourcePolicy } from "../core/image_source_policy";
import { ChannelProps, ChannelsEnabled } from "../objects/textures/channel";
import { ImageRenderable } from "../objects/renderable/image_renderable";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import { Logger } from "../utilities/logger";
import { Color } from "../core/color";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";
import { handlePointPickingEvent, PointPickingResult } from "./point_picking";
import { almostEqual } from "../utilities/almost_equal";
import { clamp } from "../utilities/clamp";
import { RenderablePool } from "../utilities/renderable_pool";

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

  public onDetached(_context: IdetikContext): void {
    if (!this.chunkStoreView_) return;
    this.releaseAndRemoveChunks(this.visibleChunks_.keys());
    this.clearObjects();
    this.chunkStoreView_.dispose();
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

  public hasMultipleLODs(): boolean {
    if (!this.chunkStoreView_) return false;
    return this.chunkStoreView_.lodCount > 1;
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

    if (!isAxisAlignedSlice(this.sliceCoords_)) {
      throw new Error(
        "ChunkedImageLayer requires axis-aligned slice coordinates"
      );
    }

    for (const [chunk, image] of this.visibleChunks_) {
      if (chunk.state !== "loaded" || !chunk.data) continue;
      const data = this.slicePlane(chunk, slicePosition);
      if (data) {
        const texture = image.textures[0] as Texture2DArray;
        texture.updateWithChunk(chunk, data, this.sliceCoords_.orientation);
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

  // exposed for use in chunk info overlay
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

    const orientation = this.sliceCoords_.orientation;

    switch (orientation) {
      case "xy": {
        const zIdx = getSliceIndex(
          sliceValue,
          chunk.offset.z,
          chunk.scale.z,
          chunk.shape.z
        );

        const sliceSize = chunk.shape.x * chunk.shape.y;
        const offset = sliceSize * zIdx;
        return chunk.data.slice(offset, offset + sliceSize);
      }

      case "xz": {
        const yIdx = getSliceIndex(
          sliceValue,
          chunk.offset.y,
          chunk.scale.y,
          chunk.shape.y
        );

        const sliceSize = chunk.shape.x * chunk.shape.z;
        const result = new (chunk.data.constructor as ChunkDataConstructor)(
          sliceSize
        );
        const rowSize = chunk.shape.x;
        const xyPlaneSize = chunk.shape.x * chunk.shape.y;

        for (let z = 0; z < chunk.shape.z; z++) {
          const srcOffset = z * xyPlaneSize + yIdx * rowSize;
          const dstOffset = z * rowSize;
          for (let x = 0; x < chunk.shape.x; x++) {
            result[dstOffset + x] = chunk.data[srcOffset + x];
          }
        }
        return result;
      }

      case "yz": {
        const xIdx = getSliceIndex(
          sliceValue,
          chunk.offset.x,
          chunk.scale.x,
          chunk.shape.x
        );

        const sliceSize = chunk.shape.y * chunk.shape.z;
        const result = new (chunk.data.constructor as ChunkDataConstructor)(
          sliceSize
        );
        const rowSize = chunk.shape.x;
        const xyPlaneSize = chunk.shape.x * chunk.shape.y;

        for (let y = 0; y < chunk.shape.y; y++) {
          for (let z = 0; z < chunk.shape.z; z++) {
            const srcOffset = z * xyPlaneSize + y * rowSize + xIdx;
            const dstOffset = y * chunk.shape.z + z;
            result[dstOffset] = chunk.data[srcOffset];
          }
        }
        return result;
      }
    }
  }

  private getImageForChunk(chunk: Chunk) {
    const existing = this.visibleChunks_.get(chunk);
    if (existing) return existing;

    if (!isAxisAlignedSlice(this.sliceCoords_)) {
      throw new Error(
        "ChunkedImageLayer requires axis-aligned slice coordinates"
      );
    }

    const pooled = this.pool_.acquire(
      poolKeyForImageRenderable(chunk, this.sliceCoords_.orientation)
    );
    if (pooled) {
      const texture = pooled.textures[0] as Texture2DArray;
      texture.updateWithChunk(
        chunk,
        this.getDataForImage(chunk),
        this.sliceCoords_.orientation
      );
      this.updateImageChunk(pooled, chunk);
      if (this.channelProps_) {
        pooled.setChannelProps(this.channelProps_);
      }
      return pooled;
    }

    return this.createImage(chunk);
  }

  private createImage(chunk: Chunk) {
    if (!isAxisAlignedSlice(this.sliceCoords_)) {
      throw new Error(
        "ChunkedImageLayer requires axis-aligned slice coordinates"
      );
    }

    const data = this.getDataForImage(chunk);
    if (!data) {
      throw new Error("No data available for image");
    }

    const texture = Texture2DArray.createWithChunk(
      chunk,
      data,
      this.sliceCoords_.orientation
    );

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
    if (!isAxisAlignedSlice(this.sliceCoords_)) {
      throw new Error(
        "ChunkedImageLayer requires axis-aligned slice coordinates"
      );
    }

    if (this.debugMode_) {
      image.wireframeEnabled = true;
      image.wireframeColor =
        this.wireframeColors_[chunk.lod % this.wireframeColors_.length];
    } else {
      image.wireframeEnabled = false;
    }

    const slicePosition = getSlicePosition(this.sliceCoords_) ?? 0;
    image.transform.setScale(
      getSliceScale(chunk, this.sliceCoords_.orientation)
    );
    image.transform.setTranslation(
      getSliceTranslation(chunk, this.sliceCoords_.orientation, slicePosition)
    );
    image.transform.setRotation(
      getSliceRotation(this.sliceCoords_.orientation)
    );
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
      const slicePosition = getSlicePosition(this.sliceCoords_);
      const data =
        slicePosition !== undefined
          ? this.slicePlane(chunk, slicePosition)!
          : chunk.data;
      const pixelIndex = y * chunk.shape.x + x;

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
    if (!isAxisAlignedSlice(this.sliceCoords_)) {
      throw new Error(
        "ChunkedImageLayer requires axis-aligned slice coordinates"
      );
    }

    for (const chunk of chunks) {
      const image = this.visibleChunks_.get(chunk);
      if (image) {
        this.pool_.release(
          poolKeyForImageRenderable(chunk, this.sliceCoords_.orientation),
          image
        );
        this.visibleChunks_.delete(chunk);
      }
    }
  }
}

function getSliceIndex(
  sliceValue: number,
  offset: number,
  scale: number,
  maxShape: number
): number {
  const local = (sliceValue - offset) / scale;
  const idx = Math.round(local);
  const clamped = clamp(idx, 0, maxShape - 1);

  // Treat values within ~1 voxel (plus tiny floating-point error) as OK.
  if (!almostEqual(local, clamped, 1 + 1e-6)) {
    Logger.error("ChunkedImageLayer", "slice value outside chunk extent");
  }

  return clamped;
}

export function poolKeyForImageRenderable(
  chunk: Chunk,
  orientation: "xy" | "xz" | "yz"
) {
  const { width, height } = getTextureDimensions(chunk, orientation);
  return [
    `lod${chunk.lod}`,
    `texture${width}x${height}`,
    `align${chunk.rowAlignmentBytes}`,
  ].join(":");
}
