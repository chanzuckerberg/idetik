import { ImageRenderableBase } from "./image_renderable_base";
import { Geometry } from "../../core/geometry";
import { Texture2DArray } from "../../objects/textures/texture_2d_array";
import {
  Channel,
  ChannelProps,
  validateChannel,
  validateChannels,
} from "../../objects/textures/channel";

export class ArrayImageRenderable extends ImageRenderableBase {
  private texture_: Texture2DArray;
  private channels_: Required<Channel>[];

  constructor(
    geometry: Geometry,
    texture: Texture2DArray,
    channels: ChannelProps[] = []
  ) {
    super();
    this.geometry = geometry;
    this.texture_ = texture;
    this.addTexture(texture);
    this.channels_ = validateChannels(texture, channels);
    this.programName =
      texture.dataType === "float" ? "floatImageArray" : "uintImageArray";
  }

  public get type() {
    return "ArrayImageRenderable";
  }

  public setChannelProps(channels: ChannelProps[]) {
    this.channels_ = validateChannels(this.texture_, channels);
  }

  public setChannelProperty<K extends keyof ChannelProps>(
    channelIndex: number,
    property: K,
    value: Required<ChannelProps>[K]
  ) {
    const newChannel = validateChannel(this.texture_, {
      ...this.channels_[channelIndex],
      [property]: value,
    });
    this.channels_[channelIndex] = newChannel;
  }

  public override getUniforms() {
    const visible: boolean[] = [];
    const color: number[] = [];
    const valueOffset: number[] = [];
    const valueScale: number[] = [];

    this.channels_.forEach((channel) => {
      visible.push(channel.visible);
      color.push(...channel.color.rgb);
      valueOffset.push(-channel.contrastLimits[0]);
      valueScale.push(
        1 / (channel.contrastLimits[1] - channel.contrastLimits[0])
      );
    });

    return {
      "Visible[0]": visible,
      "Color[0]": color,
      "ValueOffset[0]": valueOffset,
      "ValueScale[0]": valueScale,
    };
  }
}
