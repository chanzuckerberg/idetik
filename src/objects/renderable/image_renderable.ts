import { RenderableObject } from "../../core/renderable_object";
import { PlaneGeometry } from "../../objects/geometry/plane_geometry";
import { Texture } from "../../objects/textures/texture";
import {
  Channel,
  ChannelProps,
  validateChannel,
  validateChannels,
} from "../../core/channel";
import { vec3 } from "gl-matrix";
import { Shader } from "../../renderers/shaders";

type UniformValues = {
  u_color: vec3;
  u_imageSampler: number;
  Opacity: number;
  u_valueOffset: number;
  u_valueScale: number;
  u_zTexCoord: number;
};

/** @group Renderable Objects */
export class ImageRenderable extends RenderableObject {
  private channels_: Required<Channel>[];

  // The layer overwrites this per chunk with a texel-centered slice coordinate.
  // 0.5 (the texture's center) is a safe placeholder until it does.
  public sliceTexCoord = 0.5;

  constructor(
    width: number,
    height: number,
    texture: Texture,
    channels: ChannelProps[] = []
  ) {
    super();
    this.geometry = new PlaneGeometry(width, height, 1, 1);
    this.setTexture(0, texture);
    this.channels_ = validateChannels(texture, channels);
    this.programName = textureToShader(texture);
  }

  public get type() {
    return "ImageRenderable";
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

  public override getUniforms(): UniformValues {
    const texture = this.textures[0];
    if (!texture) {
      throw new Error("No texture set");
    }

    const { color, contrastLimits, opacity } =
      this.channels_[0] ?? validateChannel(texture, {});

    return {
      u_imageSampler: 0,
      u_color: color.rgb,
      u_valueOffset: -contrastLimits[0],
      u_valueScale: 1 / (contrastLimits[1] - contrastLimits[0]),
      Opacity: opacity,
      // TODO(shlomnissan): the shader still samples the texture's z-axis
      u_zTexCoord: this.sliceTexCoord,
    };
  }
}

function textureToShader(texture: Texture): Shader {
  switch (texture.dataType) {
    case "byte":
    case "int":
    case "short":
      return "intScalarImage";
    case "unsigned_short":
    case "unsigned_byte":
    case "unsigned_int":
      return "uintScalarImage";
    case "float":
      return "floatScalarImage";
  }
}
