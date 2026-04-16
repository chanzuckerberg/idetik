import { RenderableObject } from "../../core/renderable_object";
import { PlaneGeometry } from "../../objects/geometry/plane_geometry";
import { Texture } from "../../objects/textures/texture";
import {
  Channel,
  ChannelProps,
  validateChannel,
  validateChannels,
} from "../../objects/textures/channel";
import { vec3 } from "gl-matrix";
import { Shader } from "../../renderers/shaders";

type UniformValues = {
  ImageSampler: number;
  Color: vec3;
  ValueOffset: number;
  ValueScale: number;
};

export class ImageRenderable extends RenderableObject {
  private channels_: Required<Channel>[];

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

    const { color, contrastLimits } =
      this.channels_[0] ?? validateChannel(texture, {});
    return {
      ImageSampler: 0,
      Color: color.rgb,
      ValueOffset: -contrastLimits[0],
      ValueScale: 1 / (contrastLimits[1] - contrastLimits[0]),
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
