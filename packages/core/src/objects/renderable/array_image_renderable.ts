import { RenderableObject } from "../../core/renderable_object";
import { Geometry } from "../../core/geometry";
import { Texture2DArray } from "../../objects/textures/texture_2d_array";
import {
  Channel,
  ChannelProps,
  validateChannel,
  validateChannels,
} from "../../objects/textures/channel";

type ArrayUniformValues = {
  "Visible[0]": boolean[];
  "Color[0]": number[];
  "ValueOffset[0]": number[];
  "ValueScale[0]": number[];
};

export class ArrayImageRenderable extends RenderableObject {
  private channels_: Required<Channel>[];

  constructor(
    geometry: Geometry | null,
    texture: Texture2DArray | null = null,
    channels: ChannelProps[] = []
  ) {
    super();

    if (geometry) {
      this.geometry = geometry;
    }

    if (texture) {
      this.addTexture(texture);
    }

    this.channels_ = validateChannels(texture, channels);
  }

  public get type() {
    return "ArrayImageRenderable";
  }

  public addTexture(texture: Texture2DArray) {
    super.addTexture(texture);
    this.setProgramName();
  }

  public setChannelProps(channels: ChannelProps[]) {
    this.channels_ = validateChannels(this.textures[0] as Texture2DArray, channels);
  }

  public setChannelProperty<K extends keyof ChannelProps>(
    channelIndex: number,
    property: K,
    value: Required<ChannelProps>[K]
  ) {
    const newChannel = validateChannel(this.textures[0] as Texture2DArray, {
      ...this.channels_[channelIndex],
      [property]: value,
    });

    this.channels_[channelIndex] = newChannel;
  }

  public override getUniforms(): ArrayUniformValues {
    const texture = this.textures[0] as Texture2DArray;
    if (!texture) {
      throw new Error("No texture set");
    }

    const visible: boolean[] = [];
    const color: number[] = [];
    const valueOffset: number[] = [];
    const valueScale: number[] = [];

    // All channels (including defaults) are already in this.channels_
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

  private setProgramName() {
    const texture = this.textures[0] as Texture2DArray;
    if (!texture) {
      throw new Error("un-textured image not implemented");
    }
    
    this.programName =
      texture.dataType === "float" ? "floatImageArray" : "uintImageArray";
  }
}