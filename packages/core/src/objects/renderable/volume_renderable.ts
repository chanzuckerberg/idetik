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
import type { Chunk } from "../../data/chunk";

export class VolumeRenderable extends RenderableObject {
  public voxelScale: vec3 = vec3.fromValues(1, 1, 1);
  private channelMapping_: Map<number, number> = new Map();
  private channels_: Required<Channel>[];

  constructor(channels: ChannelProps[] = []) {
    super();
    this.geometry = new BoxGeometry(1, 1, 1, 1, 1, 1);
    this.cullFaceMode = "front";
    this.depthTest = false;
    this.channels_ = validateChannels(null, channels);
  }

  public get type() {
    return "VolumeRenderable";
  }

  private getTextureIndexFromChannelIndex(
    channelIndex: number
  ): number | undefined {
    return this.channelMapping_.get(channelIndex);
  }

  public addChunkToVolume(chunk: Chunk) {
    const channelIndex = chunk.chunkIndex.c;
    const texture = Texture3D.createWithChunk(chunk);

    let textureIndex = this.channelMapping_.get(channelIndex);
    if (textureIndex === undefined) {
      textureIndex = this.textures.length;
      this.channelMapping_.set(channelIndex, textureIndex);
    }
    this.setTexture(textureIndex, texture);
    this.programName = dataTypeToVolumeShader(texture.dataType);
  }

  public override getUniforms(): Record<string, unknown> {
    // One index per channel
    const loadedAndVisibleTextures = [0, 0, 0, 0];
    // prettier-ignore
    const colors = [
      1, 1, 1,
      1, 1, 1,
      1, 1, 1,
      1, 1, 1,
    ] // Up to 4 channels, RGB color for each
    const valueOffset = [0, 0, 0, 0];
    const valueScale = [1, 1, 1, 1];

    const samplerUniforms: number[] = [];

    // Allow to render without channel props specified
    const numTotalChannels = Math.max(
      this.channels_.length,
      this.channelMapping_.size
    );
    for (let i = 0; i < numTotalChannels; i++) {
      const textureIndex = this.getTextureIndexFromChannelIndex(i);
      if (textureIndex === undefined) continue;
      const texture = this.textures[textureIndex];
      const channel = validateChannel(texture, this.channels_[i] || {});
      if (!channel.visible) continue;
      const k = samplerUniforms.length;
      for (let j = 0; j < 3; j++) {
        colors[k * 3 + j] = channel.color.rgb[j];
      }
      samplerUniforms.push(textureIndex);
      valueOffset[k] = -channel.contrastLimits[0];
      valueScale[k] =
        1 / (channel.contrastLimits[1] - channel.contrastLimits[0]);
      loadedAndVisibleTextures[k] = 1;
    }

    const samplerUniformsObject = samplerUniforms.reduce<
      Record<string, number>
    >((acc, texIndex, i) => {
      acc[`Channel${i}Sampler`] = texIndex;
      return acc;
    }, {});

    return {
      ...samplerUniformsObject,
      Visible: loadedAndVisibleTextures,
      "Color[0]": colors,
      ValueOffset: valueOffset,
      ValueScale: valueScale,
      ChannelCount: numTotalChannels,
      VoxelScale: this.voxelScale,
    };
  }

  public setChannelProps(channels: ChannelProps[]) {
    let texture = null;
    if (this.channelMapping_.size !== 0) {
      const channelIndex = this.channelMapping_.keys().next().value;
      if (channelIndex !== undefined) {
        const textureIndex = this.getTextureIndexFromChannelIndex(channelIndex);
        if (textureIndex !== undefined) {
          texture = this.textures[textureIndex];
        }
      }
    }
    this.channels_ = validateChannels(texture, channels);
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
