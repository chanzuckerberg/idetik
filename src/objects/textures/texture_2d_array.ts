import { Texture } from "objects/textures/texture";
import {
  TextureChannel,
  TextureChannelProps,
  validateTextureChannel,
} from "objects/textures/texture_channel";

export class Texture2DArray extends Texture {
  private data_: ArrayBufferView;
  private readonly width_: number;
  private readonly height_: number;
  private readonly depth_: number;
  private channels_: TextureChannel[];

  constructor(data: ArrayBufferView, width: number, height: number) {
    super();

    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
    // We currently assume that each slice's size is equal to the image's area
    this.depth_ = data.byteLength / (width * height);
    this.channels_ = new Array(this.depth_).map(() =>
      validateTextureChannel(this, {})
    );
  }

  public get type() {
    return "Texture2DArray";
  }

  public set data(data: ArrayBufferView) {
    this.data_ = data;
    this.needsUpdate = true;
  }

  public get data() {
    return this.data_;
  }

  public get width() {
    return this.width_;
  }

  public get height() {
    return this.height_;
  }

  public get depth() {
    return this.depth_;
  }

  public set channels(channels: TextureChannelProps[]) {
    if (channels.length !== this.depth_) {
      throw new Error(
        `Number of channels (${channels.length}) must match the depth of the texture (${this.depth_}).`
      );
    }
    this.channels_ = channels.map((channel) =>
      validateTextureChannel(this, channel)
    );
    for (let i = 0; i < channels.length; i++) {
      this.channels_[i] = validateTextureChannel(this, channels[i]);
    }
  }

  public get channels(): TextureChannel[] {
    return this.channels_;
  }
}
