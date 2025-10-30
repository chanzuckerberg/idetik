import { Layer, LayerOptions } from "../core/layer";
import { IdetikContext } from "../idetik";
import { Chunk, ChunkSource, SliceCoordinates } from "../data/chunk";
import {
  ChunkManagerSource,
  INTERNAL_POLICY_KEY,
} from "../core/chunk_manager_source";
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
import {
  PlaybackController,
  PlaybackControllerProps,
} from "../core/playback_controller";

export type ChunkedImageLayerProps = LayerOptions & {
  source: ChunkSource;
  sliceCoords: SliceCoordinates;
  policy: ImageSourcePolicy;
  channelProps?: ChannelProps[];
  onPickValue?: (info: PointPickingResult) => void;
  playback?: PlaybackControllerProps;
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
  private readonly playbackController_?: PlaybackController;
  private policy_: ImageSourcePolicy;
  private channelProps_?: ChannelProps[];
  private chunkManagerSource_?: ChunkManagerSource;
  private pointerDownPos_: vec2 | null = null;
  private zPrevPointWorld_?: number;
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
    playback,
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
    if (playback) {
      this.playbackController_ = new PlaybackController(playback);
    }
  }

  public async onAttached(context: IdetikContext) {
    if (this.chunkManagerSource_) {
      throw new Error(
        "ChunkedImageLayer is already attached. " +
          "A layer cannot be attached to multiple LayerManagers simultaneously."
      );
    }
    this.chunkManagerSource_ = await context.chunkManager.addSource(
      this.source_,
      this.sliceCoords_,
      this.policy_
    );
  }

  public onDetached(): void {
    this.chunkManagerSource_ = undefined;
    this.releaseAndRemoveChunks(this.visibleChunks_.keys());
    this.clearObjects();
  }

  public update(timestamp?: DOMHighResTimeStamp) {
    if (this.playbackController_ && timestamp !== undefined) {
      this.playbackController_.update(timestamp);
      this.sliceCoords_.t = this.playbackController_.value;
    }
    this.updateChunks();
    this.resliceIfZChanged();
  }

  private updateChunks() {
    if (!this.chunkManagerSource_) return;
    if (this.state !== "ready") this.setState("ready");

    if (
      this.visibleChunks_.size > 0 &&
      !this.chunkManagerSource_.allVisibleLowestLODLoaded() &&
      !this.isPresentationStale()
    ) {
      return;
    }
    this.lastPresentationTimeStamp_ = performance.now();
    this.lastPresentationTimeCoord_ = this.sliceCoords_.t;

    const orderedByLOD = this.chunkManagerSource_.getChunks();
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

  private resliceIfZChanged() {
    const zPointWorld = this.sliceCoords_.z;
    if (zPointWorld === undefined || this.zPrevPointWorld_ === zPointWorld) {
      return;
    }

    for (const [chunk, image] of this.visibleChunks_) {
      if (chunk.state !== "loaded" || !chunk.data) continue;
      const data = this.slicePlane(chunk, zPointWorld);
      if (data) {
        const texture = image.textures[0] as Texture2DArray;
        texture.updateWithChunk(chunk, data);
      }
    }

    this.zPrevPointWorld_ = zPointWorld;
  }

  public onEvent(event: EventContext) {
    this.pointerDownPos_ = handlePointPickingEvent(
      event,
      this.pointerDownPos_,
      (world) => this.getValueAtWorld(world),
      this.onPickValue_
    );
  }

  public get chunkManagerSource(): ChunkManagerSource | undefined {
    return this.chunkManagerSource_;
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
      if (this.chunkManagerSource_) {
        this.chunkManagerSource_.setImageSourcePolicy(
          newPolicy,
          INTERNAL_POLICY_KEY
        );
      }
    }
  }

  private slicePlane(chunk: Chunk, zValue: number) {
    if (!chunk.data) return;
    const zLocal = (zValue - chunk.offset.z) / chunk.scale.z;
    const zIdx = Math.round(zLocal);
    const zClamped = clamp(zIdx, 0, chunk.shape.z - 1);

    // Treat values within ~1 voxel (plus tiny floating-point error) as OK.
    // Anything further away means the requested zValue is outside.
    if (!almostEqual(zLocal, zClamped, 1 + 1e-6)) {
      Logger.error("ImageLayer", "slicePlane zValue outside extent");
    }

    const sliceSize = chunk.shape.x * chunk.shape.y;
    const offset = sliceSize * zClamped;
    return chunk.data.slice(offset, offset + sliceSize);
  }

  private getImageForChunk(chunk: Chunk) {
    const existing = this.visibleChunks_.get(chunk);
    if (existing) return existing;

    const pooled = this.pool_.acquire(poolKeyForImageRenderable(chunk));
    if (pooled) {
      const texture = pooled.textures[0] as Texture2DArray;
      texture.updateWithChunk(chunk, this.getDataForImage(chunk));
      this.updateImageChunk(pooled, chunk);
      if (this.channelProps_) {
        pooled.setChannelProps(this.channelProps_);
      }
      return pooled;
    }

    return this.createImage(chunk);
  }

  private createImage(chunk: Chunk) {
    const image = new ImageRenderable(
      chunk.shape.x,
      chunk.shape.y,
      Texture2DArray.createWithChunk(chunk, this.getDataForImage(chunk)),
      this.channelProps_ ?? [{}]
    );
    this.updateImageChunk(image, chunk);
    return image;
  }

  private getDataForImage(chunk: Chunk) {
    const data =
      this.sliceCoords_?.z !== undefined
        ? this.slicePlane(chunk, this.sliceCoords_.z)
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
    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
  }

  public getValueAtWorld(world: vec3): number | null {
    const currentLOD = this.chunkManagerSource_?.currentLOD ?? 0;

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

  public get playbackController(): PlaybackController | undefined {
    return this.playbackController_;
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
    `shape${chunk.shape.x}x${chunk.shape.y}`,
    `align${chunk.rowAlignmentBytes}`,
  ].join(":");
}
