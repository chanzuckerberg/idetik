import { Layer, LayerOptions } from "../core/layer";
import { IdetikContext } from "../idetik";
import {
  Chunk,
  ChunkSource,
  SliceCoordinates,
  SlicedChunk,
} from "../data/chunk";
import { ChunkManagerSource } from "../core/chunk_manager_source";
import { ChannelProps, ChannelsEnabled } from "../objects/textures/channel";
import { ImageRenderable } from "../objects/renderable/image_renderable";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";
import { Color } from "../core/color";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";
import { handlePointPickingEvent, PointPickingResult } from "./point_picking";
import { Pool } from "../utilities/pool";

export type ChunkedImageLayerProps = LayerOptions & {
  source: ChunkSource;
  sliceCoords: SliceCoordinates;
  channelProps?: ChannelProps[];
  onPickValue?: (info: PointPickingResult) => void;
};

type ChunkedImageRenderable = {
  image: ImageRenderable;
  texture: Texture2DArray;
  data: SlicedChunk;
  chunks: Chunk[];
};

export class ChunkedImageLayer extends Layer implements ChannelsEnabled {
  public readonly type = "ChunkedImageLayer";

  private readonly source_: ChunkSource;
  private readonly sliceCoords_: SliceCoordinates;
  private readonly onPickValue_?: (info: PointPickingResult) => void;
  private readonly visibleImages_: Map<string, ChunkedImageRenderable> =
    new Map();
  private readonly pool_ = new Pool<ChunkedImageRenderable>();
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

    // First clean up any images that are no longer visible.
    const current = new Set(orderedByLOD);
    this.visibleImages_.forEach((chunked, key) => {
      for (const chunk of chunked.chunks) {
        if (!current.has(chunk)) {
          this.visibleImages_.delete(key);
          this.pool_.release(poolKeyForImageRenderable(chunk), chunked);
          break;
        }
      }
    });

    // Next, iterate through all chunks and group them by their key,
    // maintaining order by LOD.
    const loadedChunks = new Map<string, Array<Chunk | undefined>>();
    const numImageChannels = this.numImageChannels();
    for (const chunk of orderedByLOD) {
      if (chunk.state === "loaded") {
        const key = chunkKey(chunk);
        let chunks = loadedChunks.get(key);
        if (!chunks) {
          chunks = new Array<Chunk | undefined>(numImageChannels);
          loadedChunks.set(key, chunks);
        }
        const cIndex = numImageChannels === 1 ? 0 : chunk.chunkIndex.c;
        chunks[cIndex] = chunk;
      }
    }

    // Finally add objects from scratch for all complete loaded chunk sets.
    this.clearObjects();
    for (const [key, chunks] of loadedChunks) {
      if (chunks.some((c) => c === undefined)) continue;
      const chunkedImage = this.getChunkedImage(key, chunks as Chunk[]);
      this.addObject(chunkedImage.image);
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

    for (const [_, chunkedImage] of this.visibleImages_) {
      if (
        chunkedImage.chunks.some(
          (chunk) => chunk.state !== "loaded" || !chunk.data
        )
      ) {
        continue;
      }
      const slicedChunk = SlicedChunk.fromChunks(
        chunkedImage.chunks,
        zPointWorld
      );
      chunkedImage.texture.updateWithChunk(
        chunkedImage.chunks[0],
        slicedChunk.data
      );
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

  private getChunkedImage(
    key: string,
    chunks: Chunk[]
  ): ChunkedImageRenderable {
    const existing = this.visibleImages_.get(key);
    if (existing) return existing;
    const chunkedImage =
      this.getPooledImage(chunks) ?? this.createImage(chunks);
    this.visibleImages_.set(key, chunkedImage);
    return chunkedImage;
  }

  private getPooledImage(chunks: Chunk[]): ChunkedImageRenderable | undefined {
    const chunk = chunks[0];
    const pooled = this.pool_.acquire(poolKeyForImageRenderable(chunk));
    if (!pooled) return;
    const slicedChunk = SlicedChunk.fromChunks(chunks, this.sliceCoords_.z);
    pooled.texture.updateWithChunk(chunk, slicedChunk.data);
    this.updateImageChunk(pooled.image, slicedChunk);
    if (this.channelProps_) {
      pooled.image.setChannelProps(this.channelProps_);
    }
    return pooled;
  }

  private createImage(chunks: Chunk[]): ChunkedImageRenderable {
    const slicedChunk = SlicedChunk.fromChunks(chunks, this.sliceCoords_.z);
    const texture = Texture2DArray.createWithChunk(chunks[0], slicedChunk.data);
    const geometry = new PlaneGeometry(
      slicedChunk.shape.x,
      slicedChunk.shape.y,
      1,
      1
    );
    const image = new ImageRenderable(
      geometry,
      texture,
      this.channelProps_ ?? [{}]
    );
    this.updateImageChunk(image, slicedChunk);
    return { image, texture, data: slicedChunk, chunks };
  }

  private numImageChannels() {
    if (!this.chunkManagerSource_) return 1;
    if (!this.chunkManagerSource_.dimensions.c) return 1;
    if (this.sliceCoords_.c !== undefined) return 1;
    return this.chunkManagerSource_.dimensions.c.lods[0].size;
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
    for (const [_, chunkedImage] of this.visibleImages_) {
      const data = chunkedImage.data;
      if (data.lod !== currentLOD) continue;
      const value = this.getValueFromChunk(data, chunkedImage.image, world);
      if (value !== null) return value;
    }

    // Fallback to low-res chunks if no current LOD chunk contains the position
    for (const [_, chunkedImage] of this.visibleImages_) {
      const data = chunkedImage.data;
      if (data.lod === currentLOD) continue;
      const value = this.getValueFromChunk(data, chunkedImage.image, world);
      if (value !== null) return value;
    }

    return null;
  }

  private getValueFromChunk(
    chunk: SlicedChunk,
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
      const data = chunk.data;
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
    this.visibleImages_.forEach((chunkedImage) => {
      const image = chunkedImage.image;
      const chunk = chunkedImage.chunks[0];
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
    this.visibleImages_.forEach((chunkedImage) => {
      chunkedImage.image.setChannelProps(channelProps);
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

// Generates a unique key for a chunk ignoring the channel index.
function chunkKey(chunk: Chunk): string {
  return `${chunk.lod},${chunk.chunkIndex.t},${chunk.chunkIndex.z},${chunk.chunkIndex.y},${chunk.chunkIndex.x}`;
}
