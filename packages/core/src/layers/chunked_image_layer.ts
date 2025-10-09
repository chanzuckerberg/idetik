import { Layer, LayerOptions } from "../core/layer";
import { IdetikContext } from "../idetik";
import { Chunk, ChunkData, ChunkSource, SliceCoordinates } from "../data/chunk";
import { ChunkManagerSource } from "../core/chunk_manager";
import { ChannelProps, ChannelsEnabled } from "../objects/textures/channel";
import { ImageRenderable } from "../objects/renderable/image_renderable";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";
import { Logger } from "../utilities/logger";
import { Color } from "../core/color";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";
import { handlePointPickingEvent, PointPickingResult } from "./point_picking";
import { RenderablePool } from "../utilities/renderable_pool";
import { clamp } from "../utilities/clamp";
import { almostEqual } from "../utilities/almost_equal";

export type ChunkedImageLayerProps = LayerOptions & {
  source: ChunkSource;
  sliceCoords: SliceCoordinates;
  channelProps?: ChannelProps[];
  onPickValue?: (info: PointPickingResult) => void;
};

type MultiChannelChunkedImage = {
  image?: ImageRenderable;
  chunks: Array<Chunk | undefined>;
};

export class ChunkedImageLayer extends Layer implements ChannelsEnabled {
  public readonly type = "ChunkedImageLayer";

  private readonly source_: ChunkSource;
  private readonly sliceCoords_: SliceCoordinates;
  private readonly onPickValue_?: (info: PointPickingResult) => void;
  private readonly pool_ = new RenderablePool<ImageRenderable>();
  private readonly visibleChunks_: Map<string, MultiChannelChunkedImage> =
    new Map();
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

    this.visibleChunks_.forEach((chunked, key) => {
      const image = chunked.image;
      for (const chunk of chunked.chunks) {
        if (!chunk) continue;
        if (!current.has(chunk)) {
          this.visibleChunks_.delete(key);
          if (image) {
            this.pool_.release(poolKeyForImageRenderable(chunk), image);
          }
          break;
        }
      }
    });

    this.clearObjects();

    const visibleImages = new Set<ImageRenderable>();
    for (const chunk of orderedByLOD) {
      if (chunk.state !== "loaded") continue;
      const image = this.getImageForChunk(chunk);
      if (image && !visibleImages.has(image)) {
        visibleImages.add(image);
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

    for (const [_, chunked] of this.visibleChunks_) {
      for (const chunk of chunked.chunks.filter((c) => c !== undefined)) {
        if (chunk.state !== "loaded" || !chunk.data) continue;
        const data = this.slicePlane(chunk, zPointWorld);
        if (data && chunked.image) {
          const texture = chunked.image.textures[0] as Texture2DArray;
          texture.updateWithChunk(chunk, data);
        }
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

  private getImageForChunk(chunk: Chunk): ImageRenderable | undefined {
    const key = chunkKey(chunk);
    let chunked = this.visibleChunks_.get(key);

    // Initialize if needed
    if (!chunked) {
      chunked = { chunks: [] };
      this.visibleChunks_.set(key, chunked);
    }

    // Return early if image already exists
    if (chunked.image) {
      return chunked.image;
    }

    // Add chunk
    const chunks = chunked.chunks;
    chunks[chunk.chunkIndex.c] = chunk;

    // If we are missing channels, we won't create the image yet.
    if (chunks.length !== this.numImageChannels(chunk)) {
      return;
    }

    // Otherwise, reuse or create an image.
    const pooled = this.getPooledImage(chunks);
    if (pooled) {
      chunked.image = pooled;
    } else {
      chunked.image = this.createImage(chunks);
    }

    return chunked.image;
  }

  private getPooledImage(
    chunks: Array<Chunk | undefined>
  ): ImageRenderable | undefined {
    const chunk = chunks.find((c) => c !== undefined);
    if (!chunk) return;
    const pooled = this.pool_.acquire(poolKeyForImageRenderable(chunk));
    if (!pooled) return;
    const texture = pooled.textures[0] as Texture2DArray;
    for (const chunk of chunks.filter((c) => c !== undefined)) {
      const data = this.slicePlane(chunk, this.sliceCoords_.z);
      texture.updateWithChunk(chunk, data);
    }
    this.updateImageChunk(pooled, chunk);
    if (this.channelProps_) {
      pooled.setChannelProps(this.channelProps_);
    }
    return pooled;
  }

  private createImage(
    chunks: Array<Chunk | undefined>
  ): ImageRenderable | undefined {
    const chunk = chunks.find((c) => c !== undefined);
    if (!chunk) return;
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

  private getTextureData(chunks: Array<Chunk | undefined>): ChunkData {
    const chunk = chunks.find((c) => c !== undefined);
    if (!chunk || !chunk.data) {
      throw new Error("Chunk data is not loaded");
    }
    const TypedArray = chunk.data.constructor as new (
      size: number
    ) => ChunkData;
    const data = new TypedArray(
      this.numImageChannels(chunk) * chunk.shape.x * chunk.shape.y
    );
    for (const chunk of chunks) {
      if (!chunk) continue;
      const chunkData = this.slicePlane(chunk, this.sliceCoords_.z);
      if (!chunkData) {
        throw new Error("Chunk data is not loaded");
      }
      data.set(chunkData, chunk.chunkIndex.c * chunk.shape.x * chunk.shape.y);
    }
    return data;
  }

  private numImageChannels(chunk: Chunk) {
    if (!this.chunkManagerSource_) return 1;
    if (!this.chunkManagerSource_.dimensions.c) return 1;
    if (this.sliceCoords_.c !== undefined) return 1;
    return this.chunkManagerSource_.dimensions.c.lods[chunk.lod].size;
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
    for (const [_key, chunked] of this.visibleChunks_) {
      const image = chunked.image;
      if (!image) continue;
      for (const chunk of chunked.chunks.filter((c) => c !== undefined)) {
        if (chunk.lod !== currentLOD) continue;
        const value = this.getValueFromChunk(chunk, image, world);
        if (value !== null) return value;
      }
    }

    // Fallback to low-res chunks if no current LOD chunk contains the position
    for (const [_key, chunked] of this.visibleChunks_) {
      const image = chunked.image;
      if (!image) continue;
      for (const chunk of chunked.chunks.filter((c) => c !== undefined)) {
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
    this.visibleChunks_.forEach((chunked, _key) => {
      const image = chunked.image;
      if (!image) return;
      const chunk = chunked.chunks.find((c) => c !== undefined);
      if (!chunk) return;
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
    this.visibleChunks_.forEach((chunked) => {
      chunked.image?.setChannelProps(channelProps);
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
    `shape${chunk.shape.x}x${chunk.shape.y}x${chunk.shape.c}`,
    `stride${chunk.rowStride}`,
    `align${chunk.rowAlignmentBytes}`,
  ].join(":");
}

// Generates a unique key for a chunk ignoring the channel index.
function chunkKey(chunk: Chunk): string {
  return `${chunk.lod},${chunk.chunkIndex.t},${chunk.chunkIndex.z},${chunk.chunkIndex.y},${chunk.chunkIndex.x}`;
}
