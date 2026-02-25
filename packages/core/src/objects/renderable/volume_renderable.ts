import type { Shader } from "../../renderers/shaders";
import { RenderableObject } from "../../core/renderable_object";
import { BoxGeometry } from "../geometry/box_geometry";
import { TextureDataType } from "../textures/texture";
import {
  Channel,
  ChannelProps,
  validateChannel,
  validateChannels,
} from "../textures/channel";
import { Texture3D } from "../textures/texture_3d";
import { vec3 } from "gl-matrix";

export class VolumeRenderable extends RenderableObject {
  public voxelScale: vec3 = vec3.fromValues(1, 1, 1);
  private channels_: Required<Channel>[];

  constructor(
    texture: Texture3D,
    textureIndex: number,
    channels: ChannelProps[] = []
  ) {
    super();
    this.geometry = new BoxGeometry(1, 1, 1, 1, 1, 1);
    this.setTexture(textureIndex, texture);
    this.programName = dataTypeToVolumeShader(texture.dataType);
    this.cullFaceMode = "front";
    this.depthTest = false;
    this.channels_ = validateChannels(texture, channels);
  }

  public get type() {
    return "VolumeRenderable";
  }

  public override getUniforms(): Record<string, unknown> {
    const texture = this.textures[0];
    if (!texture) {
      throw new Error("No texture set");
    }
    // One index per channel
    const visible = [1, 1, 1, 1];
    // prettier-ignore
    const colors = [
      1, 1, 1,
      1, 1, 1,
      1, 1, 1,
      1, 1, 1,
    ] // Up to 4 channels, RGB color for each
    const valueOffset = [0, 0, 0, 0];
    const valueScale = [1, 1, 1, 1];

    const numChannels = this.textures.length;
    for (let i = 0; i < numChannels; i++) {
      const channel = validateChannel(
        texture,
        this.channels_[i] || {
          visible: undefined,
          color: undefined,
          contrastLimits: undefined,
        }
      );
      visible[i] = Number(channel.visible);
      for (let j = 0; j < 3; j++) {
        colors[i * 3 + j] = channel.color.rgb[j];
      }
      valueOffset[i] = -channel.contrastLimits[0];
      valueScale[i] =
        1 / (channel.contrastLimits[1] - channel.contrastLimits[0]);
    }

    return {
      Channel0Sampler: 0,
      Channel1Sampler: 1,
      Channel2Sampler: 2,
      Channel3Sampler: 3,
      Visible: visible,
      "Color[0]": colors,
      ValueOffset: valueOffset,
      ValueScale: valueScale,
      ChannelCount: numChannels,
      VoxelScale: this.voxelScale,
    };
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
