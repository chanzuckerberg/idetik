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
  private context_?: IdetikContext;

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

  public async onAttached(context: IdetikContext): Promise<void> {
    console.log("onAttached");
    this.context_ = context;
    this.chunkManagerSource_ = await context.chunkManager.addSource(
      this.source_
    );
    this.chunkManagerSource_.setRegion(this.region_);
  }

  public async update() {
    if (!this.chunkManagerSource_ || !this.context_) return;

    switch (this.state) {
      case "initialized":
        await this.updateImage();
        break;
      case "loading":
        break;
      case "ready":
        await this.updateImage();
        break;
      default: {
        const exhaustiveCheck: never = this.state;
        throw new Error(`Unhandled LayerState case: ${exhaustiveCheck}`);
      }
    }
  }

  private async updateImage() {
    if (!this.chunkManagerSource_ || !this.context_) return;

    const firstPass = this.state === "initialized";
    
    if (firstPass) {
      this.setState("loading");
    }

    const camera = this.context_.camera;
    const viewport = this.context_.viewport;

    const newChunk = await this.chunkManagerSource_.updateLOD(
      camera,
      viewport.width,
      viewport.height,
      firstPass
    );

    if (newChunk) {
      this.processChunk(newChunk, !firstPass);
    }

    if (firstPass) {
      this.setState("ready");
    }
  }

  private processChunk(chunk: ImageChunk, shouldClear: boolean) {
    this.extent_ = {
      x: chunk.shape.x * chunk.scale.x,
      y: chunk.shape.y * chunk.scale.y,
    };

    if (shouldClear) {
      this.clearObjects();
    }

    this.image_ = this.createImage(chunk);
    this.addObject(this.image_);
  }

  public get channelProps(): ChannelProps[] | undefined {
    return this.channelProps_;
  }

  public setChannelProps(channelProps: ChannelProps[]) {
    this.channelProps_ = channelProps;
    this.image_?.setChannelProps(channelProps);
  }

  private createImage(chunk: ImageChunk): ImageRenderable {
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);

    const image = new ImageRenderable(
      geometry,
      Texture2DArray.createWithImageChunk(chunk),
      this.channelProps_
    );

    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
    return image;
  }

  public get extent(): { x: number; y: number } | undefined {
    return this.extent_;
  }
}
