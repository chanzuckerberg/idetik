import { BlendingMode, Layer } from "core/layer";
import { Region } from "data/region";
import { ImageChunkSource } from "data/image_chunk";
import { Texture2DArray } from "objects/textures/texture_2d_array";
import { makeImageTextureArray, makeImageRenderable } from "layers/image_utils";
import { ChannelProps } from "objects/textures/channel";
import { ImageRenderable } from "objects/renderable/image_renderable";

export type ImageLayerProps = {
  source: ImageChunkSource;
  region: Region;
  channelProps?: ChannelProps[];
  isTransparent?: boolean;
  opacity?: number;
  blendingMode?: BlendingMode;
  zIndex?: number;
};

// Loads data from an image source into renderable objects.
export class ImageLayer extends Layer {
  private readonly source_: ImageChunkSource;
  // TODO: remove this when region is passed through to update.
  // https://github.com/chanzuckerberg/imaging-active-learning/issues/33
  private readonly region_: Region;
  private channelProps_?: ChannelProps[];
  // TODO: we don't need this texture_ field anymore
  private texture_?: Texture2DArray;
  private renderable_?: ImageRenderable;
  private extent_?: { x: number; y: number };

  constructor({
    source,
    region,
    channelProps,
    isTransparent,
    opacity,
    blendingMode,
    zIndex,
  }: ImageLayerProps) {
    super({ isTransparent, opacity, blendingMode, zIndex });
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.channelProps_ = channelProps;
  }

  public update(): void {
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
    // TODO: should this return Channel[] instead of ChannelProps[]?
    return this.channelProps_;
  }

  public setChannelProps(channelProps: ChannelProps[]): void {
    this.channelProps_ = channelProps;
    this.renderable_?.setChannelProps(channelProps);
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
    this.texture_ = makeImageTextureArray(chunk);
    this.renderable_ = makeImageRenderable(
      chunk,
      this.texture_,
      this.channelProps_
    );
    this.addObject(this.renderable_);
    this.setState("ready");
  }

  // TODO: we probably want something like this, but it should be unified across layers
  // see TracksLayer for another example
  public get extent(): { x: number; y: number } | undefined {
    return this.extent_;
  }
}
