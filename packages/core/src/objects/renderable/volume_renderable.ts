import type { Shader } from "../../renderers/shaders";
import { RenderableObject } from "../../core/renderable_object";
import { BoxGeometry } from "../geometry/box_geometry";
import type { TextureDataType } from "../textures/texture";
import type { Texture3D } from "../textures/texture_3d";
import { vec3 } from "gl-matrix";
import {
  type Channel,
  type ChannelProps,
  validateChannel,
  validateChannels,
} from "../textures/channel";

export class VolumeRenderable extends RenderableObject {
  public voxelScale: vec3 = vec3.fromValues(1, 1, 1);
  public channelIndex: number = 0;

  private channels_: Required<Channel>[];

  constructor(
    texture: Texture3D,
    channelIndex: number = 0,
    channels: ChannelProps[] = []
  ) {
    super();
    this.geometry = new BoxGeometry(1, 1, 1, 1, 1, 1);
    this.setTexture(0, texture);
    this.programName = dataTypeToVolumeShader(texture.dataType);
    this.cullFaceMode = "front";
    this.depthTest = false;
    this.channelIndex = channelIndex;
    this.channels_ = validateChannels(texture, channels);
  }

  public get visible() {
    const channel = this.getChannelOrDefault(this.channelIndex);
    return channel.visible;
  }

  public get type() {
    return "VolumeRenderable";
  }

  public override getUniforms(): Record<string, unknown> {
    const channel = this.getChannelOrDefault(this.channelIndex);
    const { color, contrastLimits } = channel;
    return {
      VoxelScale: this.voxelScale,
      Color: color.rgb,
      ValueOffset: -contrastLimits[0],
      ValueScale: 1 / (contrastLimits[1] - contrastLimits[0]),
      DebugShowChunkBoundaries: Number(this.wireframeEnabled),
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

  private getChannelOrDefault(channelIndex: number): Required<Channel> {
    return (
      this.channels_[channelIndex] ?? validateChannel(this.textures[0], {})
    );
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
