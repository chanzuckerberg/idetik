import { Layer, LayerOptions } from "../core/layer";
import { Viewport } from "../core/viewport";
import { OrthographicCamera } from "../objects/cameras/orthographic_camera";
import type { IdetikContext } from "../idetik";
import { Chunk, ChunkSource, SliceCoordinates } from "../data/chunk";
import { ChunkStoreView, INTERNAL_POLICY_KEY } from "../data/chunk_store_view";
import { ImageSourcePolicy } from "../core/image_source_policy";
import {
  ChannelProps,
  ChannelsEnabled,
  validateChannelPropsCount,
} from "../core/channel";
import { ImageRenderable } from "../objects/renderable/image_renderable";
import { Color } from "../math/color";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";
import { handlePointPickingEvent, PointPickingResult } from "./point_picking";
import { clamp } from "../utilities/clamp";
import { RenderablePool } from "../utilities/renderable_pool";
import { Texture } from "../objects/textures/texture";

/** @inline */
export type ImageLayerProps = LayerOptions & {
  source: ChunkSource;
  sliceCoords: SliceCoordinates;
  policy: ImageSourcePolicy;
  channelProps?: ChannelProps[];
  onPickValue?: (info: PointPickingResult) => void;
};

/**
 * A layer that renders a 2D slice of a chunked, multi-channel image source.
 *
 * `ImageLayer` streams chunks from a `ChunkSource` (e.g.
 * {@link OmeZarrImageSource}) according to the supplied `ImageSourcePolicy`,
 * which decides which resolution levels and chunks to load for the current
 * view. Per-channel appearance (contrast limits,
 * color, visibility) is controlled via {@link ChannelProps}, and the visible
 * slice is selected with {@link SliceCoordinates}.
 *
 * @see {@link VolumeLayer} for 3D volume rendering of the same data.
 *
 * @group Layers
 */
export class ImageLayer extends Layer implements ChannelsEnabled {
  public readonly type = "ImageLayer";

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
  }: ImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.policy_ = policy;
    this.sliceCoords_ = sliceCoords;
    this.channelProps_ = channelProps;
    this.initialChannelProps_ = channelProps;
    this.onPickValue_ = onPickValue;
  }

  protected attach(context: IdetikContext) {
    this.chunkStoreView_ = context.chunkManager.addView(
      this.source_,
      this.policy_
    );

    const channelCount = this.chunkStoreView_.channelCount;
    validateChannelPropsCount(this.channelProps_, channelCount);

    if (
      channelCount > 1 &&
      this.sliceCoords_.c !== undefined &&
      this.sliceCoords_.c.length > 1
    ) {
      throw new Error(
        `ImageLayer requires exactly one channel in sliceCoords.c ` +
          `for multi-channel sources (found ${channelCount} channels). ` +
          `Use one layer per channel.`
      );
    }
  }

  protected detach(_context: IdetikContext) {
    this.releaseAndRemoveChunks(this.visibleChunks_.keys());
    this.clearObjects();
    this.chunkStoreView_?.dispose();
    this.chunkStoreView_ = undefined;
  }

  public update(viewport?: Viewport) {
    if (!viewport || !this.chunkStoreView_) return;

    const camera = viewport.camera;
    if (camera.type !== "OrthographicCamera") {
      throw new Error(
        "Image rendering currently supports only orthographic cameras. " +
          "Update the implementation before using a perspective camera."
      );
    }

    this.chunkStoreView_.updateChunksForImage(this.sliceCoords_, {
      worldViewRect: (camera as OrthographicCamera).getWorldViewRect(),
      bufferWidthPx: viewport.getBufferRect().width,
    });

    this.updateChunks();

    for (const [chunk, imageRenderable] of this.visibleChunks_) {
      imageRenderable.zTexCoord = this.zTexCoordForChunk(chunk);
    }
  }

  private updateChunks() {
    if (!this.chunkStoreView_) return;
    if (this.state !== "ready") this.setState("ready");

    const visibleChunksResident = Array.from(this.visibleChunks_.keys()).every(
      (chunk) => chunk.texture !== undefined
    );

    if (
      this.visibleChunks_.size > 0 &&
      visibleChunksResident &&
      !this.chunkStoreView_.allVisibleFallbackLODLoaded() &&
      !this.isPresentationStale()
    ) {
      return;
    }
    this.lastPresentationTimeStamp_ = performance.now();
    this.lastPresentationTimeCoord_ = this.sliceCoords_.t;

    const orderedByLOD = this.chunkStoreView_.getChunksToRender();
    const current = new Set(orderedByLOD);
    const nonVisibleChunks = Array.from(this.visibleChunks_.keys()).filter(
      (chunk) => !current.has(chunk)
    );
    this.releaseAndRemoveChunks(nonVisibleChunks);

    this.clearObjects();
    for (const chunk of orderedByLOD) {
      const image = this.getImageForChunk(chunk, chunk.texture!);
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
      ImageLayer.STALE_PRESENTATION_MS_
    );
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

  private getImageForChunk(chunk: Chunk, texture: Texture) {
    const existing = this.visibleChunks_.get(chunk);
    if (existing) return existing;

    const pooled = this.pool_.acquire(poolKeyForImageRenderable(chunk));
    if (pooled) {
      pooled.setTexture(0, texture);
      pooled.zTexCoord = this.zTexCoordForChunk(chunk);
      pooled.setChannelProps(this.getChannelPropsForChunk(chunk));
      this.updateImageChunk(pooled, chunk);
      return pooled;
    }

    return this.createImage(chunk, texture);
  }

  private getChannelPropsForChunk(chunk: Chunk): ChannelProps[] {
    if (!this.channelProps_) return [{}];
    return [this.channelProps_[chunk.chunkIndex.c] ?? {}];
  }

  private createImage(chunk: Chunk, texture: Texture) {
    const image = new ImageRenderable(
      chunk.shape.x,
      chunk.shape.y,
      texture,
      this.getChannelPropsForChunk(chunk)
    );
    image.zTexCoord = this.zTexCoordForChunk(chunk);
    this.updateImageChunk(image, chunk);
    return image;
  }

  private zSliceIndex(chunk: Chunk): number {
    const zValue = this.sliceCoords_.z;
    if (zValue === undefined) return 0;
    const zLocal = (zValue - chunk.offset.z) / chunk.scale.z;
    return clamp(Math.round(zLocal), 0, chunk.shape.z - 1);
  }

  private zTexCoordForChunk(chunk: Chunk): number {
    return (this.zSliceIndex(chunk) + 0.5) / chunk.shape.z;
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

  public async getValueAtWorld(world: vec3): Promise<number | null> {
    const currentLOD = this.chunkStoreView_?.currentLOD ?? 0;

    for (const preferCurrentLOD of [true, false]) {
      for (const [chunk, image] of this.visibleChunks_) {
        if ((chunk.lod === currentLOD) !== preferCurrentLOD) continue;
        const value = await this.readValueFromChunk(chunk, image, world);
        if (value !== null) return value;
      }
    }
    return null;
  }

  private async readValueFromChunk(
    chunk: Chunk,
    image: ImageRenderable,
    world: vec3
  ): Promise<number | null> {
    const localPos = vec3.transformMat4(
      vec3.create(),
      world,
      image.transform.inverse
    );

    const x = Math.floor(localPos[0]);
    const y = Math.floor(localPos[1]);

    if (x < 0 || x >= chunk.shape.x || y < 0 || y >= chunk.shape.y) {
      return null;
    }

    const z = this.zSliceIndex(chunk);
    return (await image.textures[0].readTexel?.(x, y, z)) ?? null;
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
    this.visibleChunks_.forEach((image, chunk) => {
      image.setChannelProps(this.getChannelPropsForChunk(chunk));
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
    `align${chunk.rowAlignmentBytes}`,
  ].join(":");
}
