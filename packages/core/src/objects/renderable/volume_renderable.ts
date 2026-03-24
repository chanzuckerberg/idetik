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
import { Box3 } from "@/math/box3";

export class VolumeRenderable extends RenderableObject {
  public voxelScale: vec3 = vec3.fromValues(1, 1, 1);
  private fullVolumeWorldBounds_: Box3 = new Box3();
  private clippedVolumeUVWBounds_: Box3 = new Box3(
    vec3.fromValues(0, 0, 0),
    vec3.fromValues(1, 1, 1)
  );

  private channels_: Required<Channel>[];
  private channelToTextureIndex_: Map<number, number> = new Map();
  private loadedChannels_: Set<number> = new Set();

  constructor() {
    super();
    this.geometry = new BoxGeometry(1, 1, 1, 1, 1, 1);
    this.cullFaceMode = "front";
    this.depthTest = false;
    this.channels_ = [];
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

    this.updateWorldScaleAndBoundsFromChunk(chunk);
    this.loadedChannels_.add(channelIndex);
  }

  private updateWorldScaleAndBoundsFromChunk(chunk: Chunk) {
    vec3.set(this.voxelScale, chunk.scale.x, chunk.scale.y, chunk.scale.z);
    this.fullVolumeWorldBounds_.min = vec3.fromValues(
      chunk.offset.x,
      chunk.offset.y,
      chunk.offset.z
    );
    this.fullVolumeWorldBounds_.max = vec3.fromValues(
      chunk.offset.x + chunk.shape.x * chunk.scale.x,
      chunk.offset.y + chunk.shape.y * chunk.scale.y,
      chunk.offset.z + chunk.shape.z * chunk.scale.z
    );
    this.transform.setScale(
      vec3.subtract(
        vec3.create(),
        this.fullVolumeWorldBounds_.max,
        this.fullVolumeWorldBounds_.min
      )
    );
    this.transform.setTranslation(
      vec3.scaleAndAdd(
        vec3.create(),
        this.fullVolumeWorldBounds_.min,
        vec3.subtract(
          vec3.create(),
          this.fullVolumeWorldBounds_.max,
          this.fullVolumeWorldBounds_.min
        ),
        0.5
      )
    );
  }

  public clipVolumeToBounds(clipBounds: Box3) {
    // Set proxy geometry transform to match the clipped region
    const clippedMin = vec3.max(
      vec3.create(),
      this.fullVolumeWorldBounds_.min,
      clipBounds.min
    );
    const clippedMax = vec3.min(
      vec3.create(),
      this.fullVolumeWorldBounds_.max,
      clipBounds.max
    );
    const proxySize = vec3.subtract(vec3.create(), clippedMax, clippedMin);
    const proxyCenter = vec3.scaleAndAdd(
      vec3.create(),
      clippedMin,
      proxySize,
      0.5
    );
    this.transform.setScale(proxySize);
    this.transform.setTranslation(proxyCenter);
    this.visible = Box3.intersects(clipBounds, this.fullVolumeWorldBounds_);
    if (!this.visible) return;

    // Compute UVW bounds for the clipped region
    // Transform clipped world bounds to normalized volume space [0,1]
    const volumeSize = vec3.subtract(
      vec3.create(),
      this.fullVolumeWorldBounds_.max,
      this.fullVolumeWorldBounds_.min
    );

    this.clippedVolumeUVWBounds_.min = vec3.fromValues(
      (clippedMin[0] - this.fullVolumeWorldBounds_.min[0]) / volumeSize[0],
      (clippedMin[1] - this.fullVolumeWorldBounds_.min[1]) / volumeSize[1],
      (clippedMin[2] - this.fullVolumeWorldBounds_.min[2]) / volumeSize[2]
    );

    this.clippedVolumeUVWBounds_.max = vec3.fromValues(
      (clippedMax[0] - this.fullVolumeWorldBounds_.min[0]) / volumeSize[0],
      (clippedMax[1] - this.fullVolumeWorldBounds_.min[1]) / volumeSize[1],
      (clippedMax[2] - this.fullVolumeWorldBounds_.min[2]) / volumeSize[2]
    );
  }

  private addChannelTexture(channelIndex: number, chunk: Chunk): void {
    const texture = Texture3D.createWithChunk(chunk);
    const textureIndex = this.textures.length;

    this.setTexture(textureIndex, texture);
    this.channelToTextureIndex_.set(channelIndex, textureIndex);
    const newProgramName = dataTypeToVolumeShader(texture.dataType);
    if (this.programName && this.programName !== newProgramName) {
      throw new Error(
        `Volume renderable does not support multiple channels with different data types. Existing program: ${this.programName}, new channel data type: ${texture.dataType} and program: ${newProgramName}`
      );
    }
    this.programName = newProgramName;
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

  public override getUniforms(): Record<string, number[] | number> {
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

    for (let i = 0; i < numTotalChannels && samplerUniforms.length < 4; i++) {
      const textureIndex = this.channelToTextureIndex_.get(i);
      if (textureIndex === undefined || !this.loadedChannels_.has(i)) continue;

      const texture = this.textures[textureIndex];
      const channel = validateChannel(texture, this.channels_[i] || {});
      if (!channel.visible) continue;

      const k = samplerUniforms.length;
      colors[k * 3] = channel.color.rgb[0];
      colors[k * 3 + 1] = channel.color.rgb[1];
      colors[k * 3 + 2] = channel.color.rgb[2];

      samplerUniforms.push(textureIndex);
      valueOffset[k] = -channel.contrastLimits[0];
      valueScale[k] =
        1 / (channel.contrastLimits[1] - channel.contrastLimits[0]);
      loadedAndVisibleTextures[k] = 1;
    }

    return samplerUniforms.reduce<Record<string, number[] | number>>(
      (uniforms, textureIndex, i) => {
        uniforms[`Channel${i}Sampler`] = textureIndex;
        return uniforms;
      },
      {
        Visible: loadedAndVisibleTextures,
        "Color[0]": colors,
        ValueOffset: valueOffset,
        ValueScale: valueScale,
        VoxelScale: [
          this.voxelScale[0],
          this.voxelScale[1],
          this.voxelScale[2],
        ],
        BoxMinUV: [
          this.clippedVolumeUVWBounds_.min[0],
          this.clippedVolumeUVWBounds_.min[1],
          this.clippedVolumeUVWBounds_.min[2],
        ],
        BoxMaxUV: [
          this.clippedVolumeUVWBounds_.max[0],
          this.clippedVolumeUVWBounds_.max[1],
          this.clippedVolumeUVWBounds_.max[2],
        ],
      }
    );
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
