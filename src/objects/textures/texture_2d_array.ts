import {
  DataTextureTypedArray,
  Texture,
  bufferToDataType,
} from "objects/textures/texture";
import {
  Channel,
  ChannelProps,
  validateChannel,
} from "objects/textures/channel";

export class Texture2DArray extends Texture {
  private data_: DataTextureTypedArray;
  private readonly width_: number;
  private readonly height_: number;
  private readonly depth_: number;
  private channels_: Channel[];

  constructor(data: DataTextureTypedArray, width: number, height: number) {
    super();

    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
    // We currently assume that each slice's size is equal to the image's area
    this.depth_ = data.length / (width * height);
    this.channels_ = [];
    for (let i = 0; i < this.depth_; i++) {
      this.channels_.push(validateChannel(this, {}));
    }

    this.dataFormat = "scalar";
    this.dataType = bufferToDataType(data);
  }

  public get type() {
    return "Texture2DArray";
  }

  public set data(data: DataTextureTypedArray) {
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

  public set channels(channels: ChannelProps[]) {
    if (channels.length !== this.depth_) {
      throw new Error(
        `Number of channels (${channels.length}) must match the depth of the texture (${this.depth_}).`
      );
    }
    this.channels_ = channels.map((c) => validateChannel(this, c));
  }

  public get channels(): Channel[] {
    return this.channels_;
  }
}
