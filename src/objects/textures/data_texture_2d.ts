import { Texture, bufferToDataType } from "objects/textures/texture";
import {
  Channel,
  ChannelProps,
  validateChannel,
} from "objects/textures/channel";

export class DataTexture2D extends Texture {
  private data_: ArrayBufferView;
  private readonly width_: number;
  private readonly height_: number;
  private channel_: Channel;

  constructor(data: ArrayBufferView, width: number, height: number) {
    super();
    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
    this.dataFormat = "scalar";
    this.dataType = bufferToDataType(data);
    this.channel_ = validateChannel(this, {});
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

  public set channel(channel: ChannelProps) {
    this.channel_ = validateChannel(this, channel);
  }

  public get channel(): Channel {
    return this.channel_;
  }
}
