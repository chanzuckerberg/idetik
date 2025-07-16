import { Layer, LayerOptions } from "../core/layer";
import { IdetikContext } from "../idetik";
import { Region } from "../data/region";
import { ImageChunk, ImageChunkSource } from "../data/image_chunk";
import { ChunkManagerSource } from "../core/chunk_manager";
import { ChannelProps } from "../objects/textures/channel";
import { imageRenderableFromChunk } from "../objects/renderable/image_renderable";
import { ScalarImageRenderable } from "../objects/renderable/scalar_image_renderable";
import { ArrayImageRenderable } from "../objects/renderable/array_image_renderable";
import { Logger } from "../utilities/logger";

export type ImageLayerProps = LayerOptions & {
  source: ImageChunkSource;
  region: Region;
  channelProps?: ChannelProps[];
};

// Loads data from an image source into renderable objects.
export class ImageLayer extends Layer {
  public readonly type = "ImageLayer";

  private readonly source_: ImageChunkSource;
  // TODO: remove this when region is passed through to update.
  // https://github.com/chanzuckerberg/idetik/issues/33
  private readonly region_: Region;
  private useChunkManager_: boolean;
  private chunkManagerSource_?: ChunkManagerSource;
  private channelProps_?: ChannelProps[];
  private image_?: ScalarImageRenderable | ArrayImageRenderable;
  private extent_?: { x: number; y: number };
  private visibleChunks_: Map<
    ImageChunk,
    ScalarImageRenderable | ArrayImageRenderable
  > = new Map();
  private readonly lod_?: number;

  // TODO:(shlomnissan) Remove this parameter when chunk manager is used by default

  constructor({
    source,
    region,
    channelProps,
    lod,
    ...layerOptions
  }: ImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.channelProps_ = channelProps;
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
        const image = imageRenderableFromChunk(chunk, this.channelProps);
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

  public get channelProps(): ChannelProps[] | undefined {
    // TODO: should this return Channel[] instead of ChannelProps[]?
    return this.channelProps_;
  }

  public setChannelProps(channelProps: ChannelProps[]) {
    this.channelProps_ = channelProps;
    this.image_?.setChannelProps(channelProps);
  }

  private async load(region: Region) {
    if (this.state !== "initialized") {
      throw new Error(`Trying to load chunks more than once.`);
    }
    this.setState("loading");
    const loader = await this.source_.open();
    const attributes = await loader.loadAttributes();
    const lod = this.lod_ ?? attributes.length - 1;

    const chunk = await loader.loadRegion(region, lod);
    this.extent_ = {
      x: chunk.shape.x * chunk.scale.x,
      y: chunk.shape.y * chunk.scale.y,
    };

    this.image_ = imageRenderableFromChunk(chunk, this.channelProps_);
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
}
