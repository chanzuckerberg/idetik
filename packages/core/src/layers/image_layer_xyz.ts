import { Layer, LayerOptions } from "../core/layer";
import { IdetikContext } from "../idetik";
import { Region } from "../data/region";
import { ImageChunk, ImageChunkSource } from "../data/image_chunk";
import { ChunkManagerSource } from "../core/chunk_manager";
import { ChannelProps } from "../objects/textures/channel";
import { ImageRenderable } from "../objects/renderable/image_renderable";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";

export type ImageLayerProps = LayerOptions & {
  source: ImageChunkSource;
  region: Region;
  channelProps?: ChannelProps[];
};

export class ImageLayerXYZ extends Layer {
  private readonly source_: ImageChunkSource;
  private readonly region_: Region;
  private chunkManagerSource_?: ChunkManagerSource;
  private channelProps_?: ChannelProps[];
  private image_?: ImageRenderable;
  private extent_?: { x: number; y: number };

  constructor({
    source,
    region,
    channelProps,
    ...layerOptions
  }: ImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.channelProps_ = channelProps;
  }

  public async onAttached(context: IdetikContext) {
    this.chunkManagerSource_ = await context.chunkManager.addSource(
      this.source_
    );
  }

  public update() {
    if (!this.chunkManagerSource_) return;

    const chunks = this.chunkManagerSource_.getVisibleChunks();
    chunks.forEach((_) => {
      // TODO: create image renderable for visible chunks if needed
    });

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

  public get channelProps(): ChannelProps[] | undefined {
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
    const chunk = await loader.loadChunk(region);
    this.extent_ = {
      x: chunk.shape.x * chunk.scale.x,
      y: chunk.shape.y * chunk.scale.y,
    };

    this.image_ = this.createImage(chunk, this.channelProps_);
    this.addObject(this.image_);

    this.setState("ready");
  }

  public get extent(): { x: number; y: number } | undefined {
    return this.extent_;
  }

  private createImage(chunk: ImageChunk, channelProps?: ChannelProps[]) {
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);

    const image = new ImageRenderable(
      geometry,
      Texture2DArray.createWithImageChunk(chunk),
      channelProps
    );

    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
    return image;
  }
}
