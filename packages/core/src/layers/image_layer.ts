import { Layer, LayerOptions } from "../core/layer";
import { IdetikContext } from "../idetik";
import { Region } from "../data/region";
import { Chunk, ChunkSource } from "../data/chunk";
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

export type ImageLayerProps = LayerOptions & {
  source: ChunkSource;
  region: Region;
  channelProps?: ChannelProps[];
  onPickValue?: (info: PointPickingResult) => void;
};

// Loads data from an image source into renderable objects.
export class ImageLayer extends Layer implements ChannelsEnabled {
  public readonly type = "ImageLayer";

  private readonly source_: ChunkSource;
  // TODO: remove this when region is passed through to update.
  // https://github.com/chanzuckerberg/idetik/issues/33
  private readonly region_: Region;
  private readonly useChunkManager_: boolean;
  private readonly initialChannelProps_?: ChannelProps[];
  private readonly onPickValue_?: (info: PointPickingResult) => void;
  private readonly channelChangeCallbacks_: Array<() => void> = [];
  private readonly visibleChunks_: Map<Chunk, ImageRenderable> = new Map();
  private chunkManagerSource_?: ChunkManagerSource;
  private channelProps_?: ChannelProps[];
  private image_?: ImageRenderable;
  private extent_?: { x: number; y: number };
  private pointerDownPos_: vec2 | null = null;

  private readonly wireframeColors_ = [
    new Color(0.6, 0.3, 0.3),
    new Color(0.3, 0.6, 0.4),
    new Color(0.4, 0.4, 0.7),
    new Color(0.6, 0.5, 0.3),
  ];

  // TODO:(shlomnissan) Remove this parameter when chunk manager is used by default
  private readonly lod_?: number;

  constructor({
    source,
    region,
    channelProps,
    onPickValue,
    lod,
    ...layerOptions
  }: ImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.channelProps_ = channelProps;
    this.initialChannelProps_ = channelProps;
    this.onPickValue_ = onPickValue;
    this.lod_ = lod;

    const x = region.find((r) => r.dimension.toLowerCase() === "x");
    const y = region.find((r) => r.dimension.toLowerCase() === "y");
    const hasIntervals = region.some((r) => r.index.type === "interval");
    this.useChunkManager_ =
      !hasIntervals && x?.index.type === "full" && y?.index.type === "full";

    if (this.useChunkManager_) {
      Logger.info("ImageLayer", "Loading data using the chunk manager");
    }
  }

  public async onAttached(context: IdetikContext) {
    if (this.useChunkManager_) {
      this.chunkManagerSource_ = await context.chunkManager.addSource(
        this.source_,
        this.region_
      );
    }
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
    this.visibleChunks_.forEach((image, chunk) => {
      if (!currentChunks.has(chunk)) {
        this.removeObject(image);
        this.visibleChunks_.delete(chunk); // safe
      }
    });

    currentChunks.forEach((chunk) => {
      if (chunk.state === "loaded" && !this.visibleChunks_.has(chunk)) {
        const image = this.createImage(chunk, this.channelProps);
        this.visibleChunks_.set(chunk, image);
        this.addObject(image);
      }
    });
  }

  public update() {
    if (this.useChunkManager_) {
      this.updateChunks();
    } else {
      switch (this.state) {
        case "initialized":
          this.load(this.region_);
          break;
        case "loading":
        case "ready":
          break;
        default: {
          const exhaustiveCheck: never = this.state;
          throw new Error(`Unhandled LayerState case: ${exhaustiveCheck}`);
        }
      }
    }
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
    // TODO: should this return Channel[] instead of ChannelProps[]?
    return this.channelProps_;
  }
  public setChannelProps(channelProps: ChannelProps[]) {
    this.channelProps_ = channelProps;
    this.image_?.setChannelProps(channelProps);
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
    if (index === undefined) {
      throw new Error(`Callback to remove could not be found: ${callback}`);
    }
    this.channelChangeCallbacks_.splice(index, 1);
  }

  private async load(region: Region) {
    if (this.state !== "initialized") {
      throw new Error(`Trying to load chunks more than once.`);
    }
    this.setState("loading");
    const loader = await this.source_.open();
    const attributes = loader.getAttributes();
    const lod = this.lod_ ?? attributes.length - 1;

    const chunk = await loader.loadRegion(region, lod);
    this.extent_ = {
      x: chunk.shape.x * chunk.scale.x,
      y: chunk.shape.y * chunk.scale.y,
    };

    this.image_ = this.createImage(chunk, this.channelProps_);
    this.visibleChunks_.set(chunk, this.image_);
    this.addObject(this.image_);

    this.setState("ready");
  }

  // TODO: we probably want something like this, but it should be unified across layers
  // see TracksLayer for another example
  public get extent(): { x: number; y: number } | undefined {
    return this.extent_;
  }

  public get chunkManagerSource(): ChunkManagerSource | undefined {
    return this.chunkManagerSource_;
  }

  private slicePlane(chunk: Chunk, zValue: number) {
    const zLocal = Math.round((zValue - chunk.offset.z) / chunk.scale.z);
    const sliceSize = chunk.shape.x * chunk.shape.y;
    const offset = sliceSize * (zLocal % chunk.shape.z);
    return chunk.data?.slice(offset, offset + sliceSize);
  }

  private createImage(chunk: Chunk, channelProps?: ChannelProps[]) {
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);

    let data = chunk.data;
    if (chunk.shape.z > 1) {
      const zIdx = this.region_.find((r) => r.dimension.toLowerCase() === "z");
      if (zIdx?.index.type !== "point") {
        throw new Error("Expected Z index to be a point");
      }
      data = this.slicePlane(chunk, zIdx.index.value);
    }

    const image = new ImageRenderable(
      geometry,
      Texture2DArray.createWithChunk(chunk, data),
      channelProps
    );

    if (this.debugMode) {
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
      if (!chunk.data) continue;
      const localPos = vec3.transformMat4(
        vec3.create(),
        world,
        image.transform.inverse
      );

      const x = Math.floor(localPos[0]);
      const y = Math.floor(localPos[1]);

      // Check if this chunk contains the requested position
      if (x >= 0 && x < chunk.shape.x && y >= 0 && y < chunk.shape.y) {
        const pixelIndex = y * chunk.rowStride + x;
        const data = chunk.data;

        // For multi-channel images, take the first channel value
        return data[pixelIndex];
      }
    }
    return null;
  }
}
