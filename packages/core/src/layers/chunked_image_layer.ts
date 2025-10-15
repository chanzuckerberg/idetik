import { Layer, LayerOptions } from "../core/layer";
import { IdetikContext } from "../idetik";
import { Chunk, ChunkSource, SliceCoordinates } from "../data/chunk";
import { SlicedChunk } from "../data/sliced_chunk";
import { ChunkManagerSource } from "../core/chunk_manager_source";
import { ChannelProps, ChannelsEnabled } from "../objects/textures/channel";
import { ImageRenderable } from "../objects/renderable/image_renderable";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import { Color } from "../core/color";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";
import { handlePointPickingEvent, PointPickingResult } from "./point_picking";
import { RenderablePool } from "../utilities/renderable_pool";

export type ChunkedImageLayerProps = LayerOptions & {
  source: ChunkSource;
  sliceCoords: SliceCoordinates;
  channelProps?: ChannelProps[];
  onPickValue?: (info: PointPickingResult) => void;
};

type ChunkedImage = {
  image: ImageRenderable;
  sliced: SlicedChunk;
};

export class ChunkedImageLayer extends Layer implements ChannelsEnabled {
  public readonly type = "ChunkedImageLayer";

  private readonly source_: ChunkSource;
  private readonly sliceCoords_: SliceCoordinates;
  private readonly onPickValue_?: (info: PointPickingResult) => void;
  private readonly loadedChunks_: Map<string, Set<Chunk>> = new Map();
  private readonly visibleImages_: Map<string, ChunkedImage> = new Map();
  private readonly pool_ = new RenderablePool<ImageRenderable>();
  private readonly initialChannelProps_?: ChannelProps[];
  private readonly channelChangeCallbacks_: (() => void)[] = [];
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
    channelProps,
    onPickValue,
    ...layerOptions
  }: ChunkedImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.sliceCoords_ = sliceCoords;
    this.channelProps_ = channelProps;
    this.initialChannelProps_ = channelProps;
    this.onPickValue_ = onPickValue;
  }

  public async onAttached(context: IdetikContext) {
    this.chunkManagerSource_ = await context.chunkManager.addSource(
      this.source_,
      this.sliceCoords_
    );
  }

  public update() {
    this.updateChunks();
    this.resliceIfZChanged();
  }

  private updateChunks() {
    if (!this.chunkManagerSource_) return;
    if (this.state !== "ready") this.setState("ready");

    if (
      this.visibleImages_.size > 0 &&
      !this.chunkManagerSource_.allVisibleLowestLODLoaded() &&
      !this.isPresentationStale()
    ) {
      return;
    }
    this.lastPresentationTimeStamp_ = performance.now();
    this.lastPresentationTimeCoord_ = this.sliceCoords_.t;

    const orderedByLOD = this.chunkManagerSource_.getChunks();
    const current = new Set(orderedByLOD);
    this.loadedChunks_.forEach((chunks, key) => {
      for (const chunk of chunks) {
        if (!current.has(chunk)) {
          this.loadedChunks_.delete(key);
          break;
        }
      }
    });
    this.visibleImages_.forEach(({ image, sliced }, key) => {
      for (const chunk of sliced.chunks) {
        if (!current.has(chunk)) {
          this.pool_.release(poolKeyForImageRenderable(sliced), image);
          this.visibleImages_.delete(key);
          break;
        }
      }
    });

    this.clearObjects();
    const addedImages = new Set<ImageRenderable>();
    for (const chunk of orderedByLOD) {
      const image = this.getChunkedImage(chunk)?.image;
      if (image && !addedImages.has(image)) {
        this.addObject(image);
        addedImages.add(image);
      }
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

    for (const { image, sliced } of this.visibleImages_.values()) {
      sliced.sliceChunks(zPointWorld);
      (image.textures[0] as Texture2DArray).updateWithSlicedChunk(sliced);
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

  private getChunkedImage(chunk: Chunk): ChunkedImage | undefined {
    if (chunk.state !== "loaded") return;

    const key = chunkKeyIgnoringChannel(chunk);

    const existing = this.visibleImages_.get(key);
    if (existing) return existing;

    let chunks = this.loadedChunks_.get(key);
    if (!chunks) {
      chunks = new Set();
      this.loadedChunks_.set(key, chunks);
    }
    chunks.add(chunk);
    if (chunks.size < this.numImageChannels()) return;

    const sliced = SlicedChunk.fromChunks([...chunks], this.sliceCoords_.z);
    const image = this.getPooledImage(sliced) ?? this.createImage(sliced);
    this.visibleImages_.set(key, image);
    this.loadedChunks_.delete(key);
    return image;
  }

  private getPooledImage(sliced: SlicedChunk): ChunkedImage | undefined {
    const image = this.pool_.acquire(poolKeyForImageRenderable(sliced));
    if (!image) return;
    const texture = image.textures[0] as Texture2DArray;
    texture.updateWithSlicedChunk(sliced);
    this.updateImageChunk(image, sliced);
    if (this.channelProps_) {
      image.setChannelProps(this.channelProps_);
    }
    return { image, sliced };
  }

  private createImage(sliced: SlicedChunk): ChunkedImage {
    const image = new ImageRenderable(
      sliced.shape.x,
      sliced.shape.y,
      Texture2DArray.createWithSlicedChunk(sliced),
      this.channelProps_ ?? [{}]
    );
    this.updateImageChunk(image, sliced);
    return { image, sliced };
  }

  private numImageChannels() {
    if (this.chunkManagerSource_ === undefined) {
      throw new Error("ChunkManagerSource is not initialized.");
    }
    if (this.sliceCoords_.c !== undefined) return 1;
    return this.chunkManagerSource_.dimensions.c?.lods[0].size ?? 1;
  }

  private updateImageChunk(image: ImageRenderable, chunk: SlicedChunk) {
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
    for (const { image, sliced } of this.visibleImages_.values()) {
      if (sliced.lod !== currentLOD) continue;
      const value = this.getValueFromChunk(sliced, image, world);
      if (value !== null) return value;
    }

    // Fallback to low-res chunks if no current LOD chunk contains the position
    for (const { image, sliced } of this.visibleImages_.values()) {
      if (sliced.lod === currentLOD) continue;
      const value = this.getValueFromChunk(sliced, image, world);
      if (value !== null) return value;
    }

    return null;
  }

  private getValueFromChunk(
    sliced: SlicedChunk,
    image: ImageRenderable,
    world: vec3
  ): number | null {
    const localPos = vec3.transformMat4(
      vec3.create(),
      world,
      image.transform.inverse
    );

    const x = Math.floor(localPos[0]);
    const y = Math.floor(localPos[1]);

    // Check if this chunk contains the requested position
    if (x >= 0 && x < sliced.shape.x && y >= 0 && y < sliced.shape.y) {
      const pixelIndex = y * sliced.rowStride + x;

      // For multi-channel images, take the first channel value
      return sliced.data[pixelIndex];
    }

    return null;
  }

  public get debugMode(): boolean {
    return this.debugMode_;
  }

  public set debugMode(debug: boolean) {
    this.debugMode_ = debug;
    this.visibleImages_.forEach(({ image, sliced }) => {
      image.wireframeEnabled = this.debugMode_;
      if (this.debugMode_) {
        image.wireframeColor =
          this.wireframeColors_[sliced.lod % this.wireframeColors_.length];
      }
    });
  }

  public get channelProps(): ChannelProps[] | undefined {
    return this.channelProps_;
  }

  public setChannelProps(channelProps: ChannelProps[]) {
    this.channelProps_ = channelProps;
    this.visibleImages_.forEach(({ image }) => {
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
}

export function poolKeyForImageRenderable(chunk: Chunk | SlicedChunk) {
  return [
    `lod${chunk.lod}`,
    `shape${chunk.shape.x}x${chunk.shape.y}x${chunk.shape.c}`,
    `stride${chunk.rowStride}`,
    `align${chunk.rowAlignmentBytes}`,
  ].join(":");
}

function chunkKeyIgnoringChannel(chunk: Chunk): string {
  return `${chunk.lod},${chunk.chunkIndex.t},${chunk.chunkIndex.z},${chunk.chunkIndex.y},${chunk.chunkIndex.x}`;
}
