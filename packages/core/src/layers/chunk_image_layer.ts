import { Layer, LayerOptions } from "../core/layer";
import { IdetikContext } from "../idetik";
import { Chunk, ChunkSource, SliceIndices } from "../data/chunk";
import { ChunkManagerSource } from "../core/chunk_manager";
import {
  ChannelProps,
  Channels,
  ChannelsEnabled,
} from "../objects/textures/channel";
import { ImageRenderable } from "../objects/renderable/image_renderable";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";
import { Logger } from "../utilities/logger";
import { Color } from "../core/color";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";
import {
  getValueAtWorld,
  handlePointPickingEvent,
  PointPickingResult,
} from "./point_picking";
import { almostEqual } from "../utilities/almost_equal";
import { clamp } from "../utilities/clamp";

export type ChunkImageLayerProps = LayerOptions & {
  source: ChunkSource;
  sliceIndices: SliceIndices;
  channelProps?: ChannelProps[];
  onPickValue?: (info: PointPickingResult) => void;
};

export class ChunkImageLayer extends Layer implements ChannelsEnabled {
  public readonly type = "ChunkImageLayer";

  private readonly source_: ChunkSource;
  private readonly sliceIndices_: SliceIndices;
  private readonly channels_: Channels;
  private readonly onPickValue_?: (info: PointPickingResult) => void;
  private readonly visibleChunks_: Map<Chunk, ImageRenderable> = new Map();
  private chunkManagerSource_?: ChunkManagerSource;
  private pointerDownPos_: vec2 | null = null;
  private zPrevPointWorld_?: number;
  private debugMode_ = false;

  private readonly wireframeColors_ = [
    new Color(0.6, 0.3, 0.3),
    new Color(0.3, 0.6, 0.4),
    new Color(0.4, 0.4, 0.7),
    new Color(0.6, 0.5, 0.3),
  ];

  constructor({
    source,
    sliceIndices,
    channelProps,
    onPickValue,
    ...layerOptions
  }: ChunkImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.sliceIndices_ = sliceIndices;
    this.channels_ = new Channels(channelProps);
    this.onPickValue_ = onPickValue;
  }

  public async onAttached(context: IdetikContext) {
    this.chunkManagerSource_ = await context.chunkManager.addSource(
      this.source_,
      this.sliceIndices_
    );
  }

  private updateChunks() {
    if (!this.chunkManagerSource_) return;

    // Temporary until we decide how to approach state management
    if (this.state !== "ready") {
      this.setState("ready");
    }

    // TODO:(shlomnissan) Reuse images instead of deleting and creating new ones.
    //
    // This loop removes image renderables for chunks that are no longer visible
    // or no longer returned by getChunks() (e.g., due to LOD changes).
    // While this approach works for now, it may be more efficient in the future
    // to reuse renderables by updating their underlying data instead of repeatedly
    // creating new texture objects. Note: GPU resources are not currently being
    // released, so this will also need to be addressed soon.
    const currentChunks = new Set(this.chunkManagerSource_.getChunks());
    this.visibleChunks_.forEach((_image, chunk) => {
      if (!currentChunks.has(chunk)) {
        this.visibleChunks_.delete(chunk); // safe
      }
    });

    // Add all objects anew so that they respect the chunk order, which may
    // capture details important for rendering, such as LOD, instead of the
    // creation order, which is dependent on when the chunks finished loading.
    this.clearObjects();
    currentChunks.forEach((chunk) => {
      let image = this.visibleChunks_.get(chunk);
      if (!image && chunk.state === "loaded") {
        image = this.createImage(chunk, this.channelProps);
        this.visibleChunks_.set(chunk, image);
      }
      if (image) this.addObject(image);
    });
  }

  private resliceIfZChanged() {
    const pointWorld = this.sliceIndices_.z;
    if (pointWorld === undefined || this.zPrevPointWorld_ === pointWorld) {
      return;
    }

    for (const [chunk, image] of this.visibleChunks_) {
      if (chunk.state !== "loaded" || !chunk.data) continue;
      const data = this.slicePlane(chunk, pointWorld);
      if (data) {
        image.textures[0].data = data;
      }
    }

    this.zPrevPointWorld_ = pointWorld;
  }

  public update() {
    this.updateChunks();
    this.resliceIfZChanged();
  }

  public onEvent(event: EventContext) {
    this.pointerDownPos_ = handlePointPickingEvent(
      event,
      this.pointerDownPos_,
      (world) => this.getValueAtWorld(world),
      this.onPickValue_
    );
  }

  public get channelProps(): ChannelProps[] | undefined {
    return this.channels_.props;
  }

  public setChannelProps(channelProps: ChannelProps[]) {
    this.visibleChunks_.forEach((image) => {
      image.setChannelProps(channelProps);
    });
    this.channels_.setProps(channelProps);
  }

  public resetChannelProps(): void {
    this.channels_.resetProps();
  }

  public addChannelChangeCallback(callback: () => void): void {
    this.channels_.addChangeCallback(callback);
  }

  public removeChannelChangeCallback(callback: () => void): void {
    this.channels_.removeChangeCallback(callback);
  }

  public get chunkManagerSource(): ChunkManagerSource | undefined {
    return this.chunkManagerSource_;
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
    return chunk.data.subarray(offset, offset + sliceSize);
  }

  private createImage(chunk: Chunk, channelProps?: ChannelProps[]) {
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);

    let data = chunk.data;
    if (this.sliceIndices_.z !== undefined) {
      data = this.slicePlane(chunk, this.sliceIndices_.z);
    }

    const image = new ImageRenderable(
      geometry,
      Texture2DArray.createWithChunk(chunk, data),
      channelProps
    );

    if (this.debugMode_) {
      image.wireframeEnabled = true;
      image.wireframeColor =
        this.wireframeColors_[chunk.lod % this.wireframeColors_.length];
    }

    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
    return image;
  }

  public getValueAtWorld(world: vec3): number | null {
    // Iterate through all visible chunks to find the one containing the world position
    for (const [chunk, image] of this.visibleChunks_) {
      const value = getValueAtWorld(world, image.transform, chunk);
      if (value !== null) return value;
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
}
