import { Layer, LayerOptions } from "../core/layer";
import { Region } from "../data/region";
import { Chunk, ChunkSource } from "../data/chunk";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import {
  ChannelProps,
  Channels,
  ChannelsEnabled,
} from "../objects/textures/channel";
import { ImageRenderable } from "../objects/renderable/image_renderable";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";
import { ImageSeriesLoader, SetIndexResult } from "./image_series_loader";

export type ImageSeriesLayerProps = LayerOptions & {
  source: ChunkSource;
  region: Region;
  seriesDimensionName: string;
  channelProps?: ChannelProps[];
  lod?: number;
};

export class ImageSeriesLayer extends Layer implements ChannelsEnabled {
  public readonly type = "ImageSeriesLayer";
  private readonly seriesLoader_: ImageSeriesLoader;
  private readonly channels_: Channels;
  private texture_: Texture2DArray | null = null;
  private image_?: ImageRenderable;
  private extent_?: { x: number; y: number };

  constructor({
    source,
    region,
    seriesDimensionName,
    channelProps,
    lod,
    ...layerOptions
  }: ImageSeriesLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.channels_ = new Channels(channelProps);
    this.seriesLoader_ = new ImageSeriesLoader({
      source,
      region,
      seriesDimensionName,
      lod,
    });
  }

  public update() {
    if (this.state === "initialized") {
      this.setState("loading");
      this.seriesLoader_.loadSeriesAttributes();
    }
  }

  public get channelProps(): ChannelProps[] | undefined {
    return this.channels_.props;
  }

  public setChannelProps(channelProps: ChannelProps[]): void {
    this.image_?.setChannelProps(channelProps);
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

  public async setPosition(position: number): Promise<SetIndexResult> {
    const result = await this.seriesLoader_.setPosition(position);
    return this.processIndexResult(result);
  }

  public async setIndex(index: number): Promise<SetIndexResult> {
    const result = await this.seriesLoader_.setIndex(index);
    return this.processIndexResult(result);
  }

  public close() {
    this.seriesLoader_.shutdown();
  }

  public async preloadSeries() {
    return this.seriesLoader_.preloadAllChunks();
  }

  public get extent(): { x: number; y: number } | undefined {
    return this.extent_;
  }

  private processIndexResult(result: SetIndexResult) {
    if (result.chunk) {
      this.setData(result.chunk);
      this.setState("ready");
    }
    return result;
  }

  private setData(chunk: Chunk) {
    if (!this.texture_ || !this.image_) {
      this.texture_ = Texture2DArray.createWithChunk(chunk);
      this.image_ = this.createImage(chunk, this.texture_, this.channelProps);
      this.addObject(this.image_);

      // extent does not change after renderable creation
      this.extent_ = {
        x: chunk.shape.x * chunk.scale.x,
        y: chunk.shape.y * chunk.scale.y,
      };
    } else if (chunk.data) {
      this.texture_.data = chunk.data;
    }
  }

  private createImage(
    chunk: Chunk,
    texture: Texture2DArray,
    channelProps?: ChannelProps[]
  ) {
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);
    const image = new ImageRenderable(geometry, texture, channelProps);
    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
    return image;
  }
}
