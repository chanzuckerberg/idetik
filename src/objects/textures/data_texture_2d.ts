import { Texture, bufferToDataType } from "objects/textures/texture";
import {
  TextureChannel,
  TextureChannelProps,
  validateTextureChannel,
} from "objects/textures/texture_channel";

export class DataTexture2D extends Texture {
  private data_: ArrayBufferView;
  private readonly width_: number;
  private readonly height_: number;
  private channel_: TextureChannel;

  constructor(data: ArrayBufferView, width: number, height: number) {
    super();
    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
    this.dataFormat = "scalar";
    this.dataType = bufferToDataType(data);
    this.channel_ = validateTextureChannel(this, {});
  }

  public set data(data: ArrayBufferView) {
    this.data_ = data;
    this.needsUpdate = true;
  }

  public get type() {
    return "DataTexture2D";
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

  public set channel(channel: TextureChannelProps) {
    this.channel_ = validateTextureChannel(this, channel);
  }

  public get channel(): TextureChannel {
    return this.channel_;
  }
}
