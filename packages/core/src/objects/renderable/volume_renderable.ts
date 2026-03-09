import type { Shader } from "../../renderers/shaders";
import { RenderableObject } from "../../core/renderable_object";
import { BoxGeometry } from "../geometry/box_geometry";
import { type Texture, TextureDataType } from "../textures/texture";
import {
  Channel,
  ChannelProps,
  validateChannel,
  validateChannels,
} from "../textures/channel";
import { Texture3D } from "../textures/texture_3d";
import { vec3 } from "gl-matrix";
import type { Chunk } from "../../data/chunk";
import { Logger } from "@/utilities/logger";

export class VolumeRenderable extends RenderableObject {
  public voxelScale: vec3 = vec3.fromValues(1, 1, 1);

  private channels_: Required<Channel>[];
  private channelToTextureIndex_: Map<number, number> = new Map();
  private loadedChannels_: Set<number> = new Set();

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

  public updateVolumeWithChunk(chunk: Chunk): void {
    const channelIndex = chunk.chunkIndex.c;

    const textureIndex = this.channelToTextureIndex_.get(channelIndex);
    if (textureIndex !== undefined) {
      this.updateChannelTexture(textureIndex, chunk);
    } else {
      this.addChannelTexture(channelIndex, chunk);
    }

    this.loadedChannels_.add(channelIndex);
  }

  private addChannelTexture(channelIndex: number, chunk: Chunk): void {
    const texture = Texture3D.createWithChunk(chunk);
    const textureIndex = this.textures.length;

    this.setTexture(textureIndex, texture);
    this.channelToTextureIndex_.set(channelIndex, textureIndex);
    this.programName = dataTypeToVolumeShader(texture.dataType);
  }

  private updateChannelTexture(textureIndex: number, chunk: Chunk): void {
    const texture = this.textures[textureIndex];

    if (!(texture instanceof Texture3D)) {
      const newTexture = Texture3D.createWithChunk(chunk);
      this.setTexture(textureIndex, newTexture);
      return;
    }

    texture.updateWithChunk(chunk);
  }

  public clearLoadedChannels() {
    this.loadedChannels_ = new Set();
  }

  public override getUniforms(): Record<string, unknown> {
    const loadedAndVisibleTextures = [0, 0, 0, 0];
    // prettier-ignore
    const colors = [
      1, 1, 1,
      1, 1, 1,
      1, 1, 1,
      1, 1, 1,
    ]
    const valueOffset = [0, 0, 0, 0];
    const valueScale = [1, 1, 1, 1];
    const samplerUniforms: number[] = [];

    // Allow to render without channel props specified
    const numTotalChannels = Math.max(
      this.channels_.length,
      this.channelToTextureIndex_.size
    );

    for (let i = 0; i < numTotalChannels; i++) {
      if (!this.loadedChannels_.has(i)) continue;
      const textureIndex = this.channelToTextureIndex_.get(i);
      if (textureIndex === undefined) continue;
      const texture = this.textures[textureIndex];
      const channel = validateChannel(texture, this.channels_[i] || {});
      if (!channel.visible) continue;
      const k = samplerUniforms.length;
      if (k >= 4) {
        Logger.warn(
          "VolumeRenderable",
          `Maximum of 4 channels can be rendered, but more were requested. Only the first 4 channels out of all visible channels will be rendered.`
        );
        break;
      }
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
    >((uniforms, textureIndex, i) => {
      uniforms[`Channel${i}Sampler`] = textureIndex;
      return uniforms;
    }, {});

    return {
      ...samplerUniformsObject,
      Visible: loadedAndVisibleTextures,
      "Color[0]": colors,
      ValueOffset: valueOffset,
      ValueScale: valueScale,
      VoxelScale: this.voxelScale,
    };
  }

  /**
   * Get an available texture for a channel. If desiredChannelIndex is provided, it will try to return the texture for that channel index. If that texture is not available, or no desiredChannelIndex is passed, return the first available channel texture. This is used to determine which texture to use when updating channel properties, since channel properties can be updated even if the channel's texture hasn't been loaded yet. If no textures are available, it returns null, which signals that default contrast limits should be used when validating the channel properties.
   */
  private getAvailableChannelTexture(
    desiredChannelIndex?: number
  ): Texture | null {
    if (desiredChannelIndex !== undefined) {
      const textureIndex = this.channelToTextureIndex_.get(desiredChannelIndex);
      if (textureIndex !== undefined) return this.textures[textureIndex];
    }

    const firstTextureIndex = this.channelToTextureIndex_.values().next().value;
    return firstTextureIndex !== undefined
      ? this.textures[firstTextureIndex]
      : null;
  }

  public setChannelProps(channels: ChannelProps[]) {
    this.channels_ = validateChannels(
      this.getAvailableChannelTexture(),
      channels
    );
  }

  public setChannelProperty<K extends keyof ChannelProps>(
    channelIndex: number,
    property: K,
    value: Required<ChannelProps>[K]
  ) {
    const newChannel = validateChannel(
      this.getAvailableChannelTexture(channelIndex),
      {
        ...this.channels_[channelIndex],
        [property]: value,
      }
    );

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
