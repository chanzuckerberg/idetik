import type { Shader } from "../../renderers/shaders";
import { RenderableObject } from "../../core/renderable_object";
import { BoxGeometry } from "../geometry/box_geometry";
import type { Texture, TextureDataType } from "../textures/texture";
import type { Texture3DArray } from "../textures/texture_3d_array";
import {
  Channel,
  ChannelProps,
  validateChannel,
  validateChannels,
} from "../textures/channel";
import { Texture3D } from "../textures/texture_3d";

export class VolumeRenderable extends RenderableObject {
  private channels_: Required<Channel>[];
  private depthSlices_: number;

  constructor(
    texture: Texture3D | Texture3DArray,
    channels: ChannelProps[] = [],
    depthSlices?: number
  ) {
    super();
    this.geometry = new BoxGeometry(1, 1, 1, 1, 1, 1);
    this.setTexture(0, texture);
    this.programName = textureToShader(texture);
    this.cullFaceMode = "front";
    this.depthTest = false;
    this.channels_ = validateChannels(texture, channels);
    // Calculate depth slices: total depth divided by number of channels
    this.depthSlices_ =
      depthSlices ??
      (channels.length > 0 ? texture.depth / channels.length : texture.depth);
  }

  public setChannelProps(channels: ChannelProps[]) {
    this.channels_ = validateChannels(this.textures[0], channels);
  }

  public setChannelProperty<K extends keyof ChannelProps>(
    channelIndex: number,
    property: K,
    value: Required<ChannelProps>[K]
  ) {
    const newChannel = validateChannel(this.textures[0], {
      ...this.channels_[channelIndex],
      [property]: value,
    });

    this.channels_[channelIndex] = newChannel;
  }

  public get type() {
    return "VolumeRenderable";
  }

  public override getUniforms(): Record<string, unknown> {
    const visible: boolean[] = [];
    const color: number[] = [];
    const valueOffset: number[] = [];
    const valueScale: number[] = [];

    const texture = this.textures[0];
    if (!texture) {
      throw new Error("No texture set");
    }

    if (texture.type === "Texture3D") {
      return {};
    }

    // Build arrays for all channels
    this.channels_.forEach((channel) => {
      visible.push(channel.visible);
      color.push(...channel.color.rgb);
      valueOffset.push(-channel.contrastLimits[0]);
      valueScale.push(
        1 / (channel.contrastLimits[1] - channel.contrastLimits[0])
      );
    });

    return {
      ImageSampler: 0,
      "Visible[0]": visible,
      "Color[0]": color,
      "ValueOffset[0]": valueOffset,
      "ValueScale[0]": valueScale,
      ChannelCount: this.channels_.length,
      DepthSlices: this.depthSlices_,
    };
  }
}

function textureToShader(texture: Texture) {
  if (texture.type === "Texture3D") {
    return dataTypeToVolumeShader(texture.dataType);
  } else if (texture.type === "Texture3DArray") {
    return dataTypeToArrayVolumeShader(texture.dataType);
  }
  throw new Error(`Unsupported image texture type: ${texture.type}`);
}

function dataTypeToVolumeShader(dataType: TextureDataType): Shader {
  switch (dataType) {
    case "byte":
    case "int":
    case "short":
      return "intVolume";
    case "unsigned_short":
    case "unsigned_byte":
    case "unsigned_int":
      return "uintVolume";
    case "float":
      return "floatVolume";
  }
}

function dataTypeToArrayVolumeShader(dataType: TextureDataType): Shader {
  switch (dataType) {
    case "byte":
    case "int":
    case "short":
      return "intVolumeArray";
    case "unsigned_short":
    case "unsigned_byte":
    case "unsigned_int":
      return "uintVolumeArray";
    case "float":
      return "floatVolumeArray";
  }
}
