import type { Shader } from "../../renderers/shaders";
import { RenderableObject } from "../../core/renderable_object";
import { BoxGeometry } from "../geometry/box_geometry";
import {
  textureDefaultValueRange,
  Texture,
  TextureDataType,
} from "../textures/texture";
import type { Texture3DArray } from "../textures/texture_3d_array";
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
    texture: Texture3D | Texture3DArray,
    textureIndex: number,
    channels: ChannelProps[] = []
  ) {
    super();
    this.geometry = new BoxGeometry(1, 1, 1, 1, 1, 1);
    this.setTexture(textureIndex, texture);
    this.programName = textureToShader(texture);
    this.cullFaceMode = "front";
    this.depthTest = false;
    this.channels_ = validateChannels(texture, channels);
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
    const visible: number[] = Array(4).fill(1);
    const colors: number[] = Array(12).fill(1);
    const valueOffset: number[] = Array(4).fill(0);
    const valueScale: number[] = Array(4).fill(1);

    const texture = this.textures[0];
    if (!texture) {
      throw new Error("No texture set");
    }

    // If no channels provided, assume single channel with default settings
    if (this.channels_.length === 0) {
      const defaultRange = textureDefaultValueRange(texture);
      return {
        Channel0Sampler: 0,
        Visible: visible,
        "Color[0]": colors,
        ValueOffset: [-defaultRange[0], 0, 0, 0],
        ValueScale: [1 / (defaultRange[1] - defaultRange[0]), 0, 0, 0],
        ChannelCount: 1,
        VoxelScale: this.voxelScale,
      };
    }

    for (let i = 0; i < this.channels_.length; i++) {
      visible[i] = Number(this.channels_[i].visible);
      for (let j = 0; j < 3; j++) {
        colors[i * 3 + j] = this.channels_[i].color.rgb[j];
      }
      valueOffset[i] = -this.channels_[i].contrastLimits[0];
      valueScale[i] =
        1 /
        (this.channels_[i].contrastLimits[1] -
          this.channels_[i].contrastLimits[0]);
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
      ChannelCount: this.channels_.length,
      VoxelScale: this.voxelScale,
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
