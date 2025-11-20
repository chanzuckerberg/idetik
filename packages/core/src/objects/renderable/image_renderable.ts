import { RenderableObject } from "../../core/renderable_object";
import { PlaneGeometry } from "../../objects/geometry/plane_geometry";
import { Texture, TextureDataType } from "../../objects/textures/texture";
import {
  Channel,
  ChannelProps,
  validateChannel,
  validateChannels,
} from "../../objects/textures/channel";
import { vec3 } from "gl-matrix";
import { Shader } from "../../renderers/shaders";

type SingleUniformValues = {
  ImageSampler: number;
  Color: vec3;
  ValueOffset: number;
  ValueScale: number;
  ChannelCount: number;
};

type ArrayUniformValues = {
  ImageSampler: number;
  ChannelCount: number;
  "Visible[0]": boolean[];
  "Color[0]": number[];
  "ValueOffset[0]": number[];
  "ValueScale[0]": number[];
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

  public override getUniforms(): SingleUniformValues | ArrayUniformValues {
    const texture = this.textures[0];
    if (!texture) {
      throw new Error("No texture set");
    }

    if (texture.type === "Texture2D") {
      const { color, contrastLimits } =
        this.channels_[0] ?? validateChannel(texture, {});
      return {
        ImageSampler: 0,
        Color: color.rgb,
        ValueOffset: -contrastLimits[0],
        ValueScale: 1 / (contrastLimits[1] - contrastLimits[0]),
        ChannelCount: 1,
      };
    } else {
      // Texture2DArray case
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
        ImageSampler: 0,
        "Visible[0]": visible,
        "Color[0]": color,
        "ValueOffset[0]": valueOffset,
        "ValueScale[0]": valueScale,
        ChannelCount: this.channels_.length,
      };
    }
  }
}

function textureToShader(texture: Texture) {
  if (texture.type === "Texture2D") {
    return dataTypeToScalarImageShader(texture.dataType);
  } else if (texture.type === "Texture2DArray") {
    return dataTypeToArrayImageShader(texture.dataType);
  }
  throw new Error(`Unsupported image texture type: ${texture.type}`);
}

function dataTypeToScalarImageShader(dataType: TextureDataType): Shader {
  switch (dataType) {
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

function dataTypeToArrayImageShader(dataType: TextureDataType): Shader {
  switch (dataType) {
    case "byte":
    case "int":
    case "short":
      return "intScalarImageArray";
    case "unsigned_short":
    case "unsigned_byte":
    case "unsigned_int":
      return "uintScalarImageArray";
    case "float":
      return "floatScalarImageArray";
  }
}
