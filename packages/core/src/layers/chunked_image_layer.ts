import { Layer, LayerOptions } from "../core/layer";
import { IdetikContext } from "../idetik";
import {
  Chunk,
  ChunkSource,
  sliceChunk2D,
  SliceCoordinates,
} from "../data/chunk";
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

export type ChunkedImageLayerProps = LayerOptions & {
  source: ChunkSource;
  sliceCoords: SliceCoordinates;
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
  private channelProps_?: ChannelProps[];
  private chunkManagerSource_?: ChunkManagerSource;
  private pointerDownPos_: vec2 | null = null;
  private zPrevPointWorld_?: number;
  private tPrevPointWorld_?: number;
  private debugMode_ = false;

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
    this.sliceChunks();
  }

  private updateChunks() {
    if (!this.chunkManagerSource_) return;
    if (this.state !== "ready") this.setState("ready");

    const orderedByLOD = this.chunkManagerSource_.getChunks();
    const current = new Set(orderedByLOD);

    this.visibleChunks_.forEach((image, chunk) => {
      if (!current.has(chunk)) {
        this.visibleChunks_.delete(chunk);
        this.pool_.release(poolKeyForImageRenderable(chunk), image);
      }
    });

    this.clearObjects();
    for (const chunk of orderedByLOD) {
      if (chunk.state !== "loaded") continue;
      const image = this.getImageForChunk(chunk);
      this.visibleChunks_.set(chunk, image);
      this.addObject(image);
    }
  }

  private sliceChunks() {
    // TODO: check if explicit undefined check is needed.
    const zPointWorld = this.sliceCoords_.z;
    const tPointWorld = this.sliceCoords_.t;
    if (zPointWorld === undefined && tPointWorld === undefined) return;
    if (
      zPointWorld === this.zPrevPointWorld_ &&
      tPointWorld === this.tPrevPointWorld_
    )
      return;

    for (const [chunk, image] of this.visibleChunks_) {
      if (chunk.state !== "loaded" || !chunk.data) continue;
      const chunkSlice = sliceChunk2D(chunk, this.sliceCoords_);
      const texture = image.textures[0] as Texture2DArray;
      texture.updateWithChunkSlice(chunkSlice);
    }

    this.zPrevPointWorld_ = zPointWorld;
    this.tPrevPointWorld_ = tPointWorld;
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

  private getImageForChunk(chunk: Chunk) {
    const existing = this.visibleChunks_.get(chunk);
    if (existing) return existing;

    const pooled = this.pool_.acquire(poolKeyForImageRenderable(chunk));
    if (pooled) {
      const texture = pooled.textures[0] as Texture2DArray;
      const chunkSlice = sliceChunk2D(chunk, this.sliceCoords_);
      texture.updateWithChunkSlice(chunkSlice);
      this.updateImageChunk(pooled, chunk);
      if (this.channelProps_) {
        pooled.setChannelProps(this.channelProps_);
      }
      return pooled;
    }

    return this.createImage(chunk);
  }

  private createImage(chunk: Chunk) {
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);
    const image = new ImageRenderable(
      geometry,
      Texture2DArray.createWithChunk(chunk, this.getDataForImage(chunk)),
      this.channelProps_ ?? [{}]
    );
    this.updateImageChunk(image, chunk);
    return image;
  }

  private getDataForImage(chunk: Chunk) {
    if (!chunk.data) {
      Logger.warn("ChunkedImageLayer", "No data for image");
      return;
    }
    const chunkSlice = sliceChunk2D(chunk, this.sliceCoords_);
    return chunkSlice.data;
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
      const chunkSlice = sliceChunk2D(chunk, this.sliceCoords_);
      const data = chunkSlice.data;
      const pixelIndex = y * chunk.rowStride + x;
      // For multi-channel images, take the first channel value
      return data[pixelIndex];
    }

    return null;
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
}

export function poolKeyForImageRenderable(chunk: Chunk) {
  return [
    `lod${chunk.lod}`,
    `shape${chunk.shape.x}x${chunk.shape.y}`,
    `stride${chunk.rowStride}`,
    `align${chunk.rowAlignmentBytes}`,
  ].join(":");
}
