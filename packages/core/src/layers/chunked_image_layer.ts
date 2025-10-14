import { Layer, LayerOptions } from "../core/layer";
import { IdetikContext } from "../idetik";
import { Chunk, ChunkData, ChunkSource, SliceCoordinates } from "../data/chunk";
import { ChunkManagerSource } from "../core/chunk_manager_source";
import { ChannelProps, ChannelsEnabled } from "../objects/textures/channel";
import { ImageRenderable } from "../objects/renderable/image_renderable";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";
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
  channelProps?: ChannelProps[];
  onPickValue?: (info: PointPickingResult) => void;
};

type ChunkedImage = {
  image: ImageRenderable;
  chunks: ReadonlyArray<Chunk>;
};

export class ChunkedImageLayer extends Layer implements ChannelsEnabled {
  public readonly type = "ChunkedImageLayer";

  private readonly source_: ChunkSource;
  private readonly sliceCoords_: SliceCoordinates;
  private readonly onPickValue_?: (info: PointPickingResult) => void;
  private readonly loadedChunks_: Map<string, Array<Chunk | undefined>> = new Map();
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
        if (chunk && !current.has(chunk)) {
          this.loadedChunks_.delete(key);
          const image = this.visibleImages_.get(key)?.image;
          if (image) {
            this.pool_.release(poolKeyForImageRenderable(chunk), image);
            this.visibleImages_.delete(key);
          }
          break;
        }
      }
    });

    this.clearObjects();
    for (const chunk of orderedByLOD) {
      const image = this.getChunkedImage(chunk)?.image;
      if (image) {
        this.addObject(image);
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

    for (const chunkedImage of this.visibleImages_.values()) {
      const chunks = chunkedImage.chunks;
      const data = this.getTextureData(chunks);
      const texture = chunkedImage.image.textures[0] as Texture2DArray;
      texture.updateWithChunk(chunks[0], data);
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

  private slicePlane(chunk: Chunk, zValue?: number) {
    if (!chunk.data) return;
    if (zValue === undefined) return chunk.data;
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

  private getChunkedImage(chunk: Chunk): ChunkedImage | undefined {
    const key = chunkKeyIgnoringChannel(chunk);

    const existing = this.visibleImages_.get(key);
    if (existing) return existing;

    let chunks = this.loadedChunks_.get(key);
    if (!chunks) {
      chunks = [];
      this.loadedChunks_.set(key, chunks);
    }
    const cIndex = this.getTextureChannelIndex(chunk);
    chunks[cIndex] = chunk;

    const completeChunks = this.getCompleteChunks(chunks);
    if (!completeChunks) return;

    const image = this.getPooledImage(completeChunks) ?? this.createImage(completeChunks);

    const chunkedImage = { image, chunks: completeChunks };
    this.visibleImages_.set(key, chunkedImage);
    return chunkedImage;
  }

  private getCompleteChunks(chunks: Array<Chunk | undefined>): ReadonlyArray<Chunk> | undefined {
    const complete: Chunk[] = [];
    for (let c = 0; c < this.numImageChannels(); c++) {
      const chunk = chunks[c];
      if (!chunk || chunk.state !== "loaded") {
        return;
      }
      complete.push(chunk);
    }
    return complete;
  }

  private getPooledImage(chunks: ReadonlyArray<Chunk>): ImageRenderable | undefined {
    const chunk = chunks[0];
    const pooled = this.pool_.acquire(poolKeyForImageRenderable(chunk));
    if (!pooled) return;
    const texture = pooled.textures[0] as Texture2DArray;
    const data = this.getTextureData(chunks);
    texture.updateWithChunk(chunk, data);
    this.updateImageChunk(pooled, chunk);
    if (this.channelProps_) {
      pooled.setChannelProps(this.channelProps_);
    }
    return pooled;
  }

  private createImage(chunks: ReadonlyArray<Chunk>): ImageRenderable {
    const chunk = chunks[0];
    const data = this.getTextureData(chunks);
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);
    const image = new ImageRenderable(
      geometry,
      Texture2DArray.createWithChunk(chunk, data),
      this.channelProps_ ?? [{}]
    );
    this.updateImageChunk(image, chunk);
    return image;
  }

  private getTextureData(chunks: ReadonlyArray<Chunk>): ChunkData {
    const chunk = chunks[0];
    if (!chunk.data) {
      throw new Error("Chunk data is not loaded");
    }
    const TypedArray = chunk.data.constructor as new (
      size: number
    ) => ChunkData;
    const data = new TypedArray(chunks.length * chunk.shape.x * chunk.shape.y);
    for (const chunk of chunks) {
      const chunkData = this.slicePlane(chunk, this.sliceCoords_.z);
      if (!chunkData) {
        throw new Error("Chunk data is not loaded");
      }
      const cIndex = this.getTextureChannelIndex(chunk);
      data.set(chunkData, cIndex * chunk.shape.x * chunk.shape.y);
    }
    return data;
  }

  private getTextureChannelIndex(chunk: Chunk): number {
    if (this.sliceCoords_.c) return 0;
    return chunk.chunkIndex.c;
  }

  private numImageChannels() {
    if (!this.chunkManagerSource_) return 1;
    if (!this.chunkManagerSource_.dimensions.c) return 1;
    if (this.sliceCoords_.c !== undefined) return 1;
    return this.chunkManagerSource_.dimensions.c.lods[0].size;
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
    for (const {image, chunks} of this.visibleImages_.values()) {
      for (const chunk of chunks) {
        if (chunk.lod !== currentLOD) continue;
        const value = this.getValueFromChunk(chunk, image, world);
        if (value !== null) return value;
      }
    }

    // Fallback to low-res chunks if no current LOD chunk contains the position
    for (const {image, chunks} of this.visibleImages_.values()) {
      for (const chunk of chunks) {
        if (chunk.lod === currentLOD) continue;
        const value = this.getValueFromChunk(chunk, image, world);
        if (value !== null) return value;
      }
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
      const data = this.slicePlane(chunk, this.sliceCoords_.z)!;
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
    this.visibleImages_.forEach(({image, chunks}) => {
      const chunk = chunks[0];
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
    this.visibleImages_.forEach(({image}) => {
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

export function poolKeyForImageRenderable(chunk: Chunk) {
  return [
    `lod${chunk.lod}`,
    `shape${chunk.shape.x}x${chunk.shape.y}`,
    `stride${chunk.rowStride}`,
    `align${chunk.rowAlignmentBytes}`,
  ].join(":");
}

function chunkKeyIgnoringChannel(chunk: Chunk): string {
  return `${chunk.lod},${chunk.chunkIndex.t},${chunk.chunkIndex.z},${chunk.chunkIndex.y},${chunk.chunkIndex.x}`;
}
