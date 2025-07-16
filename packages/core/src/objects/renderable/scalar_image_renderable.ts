import { ImageRenderableBase } from "./image_renderable_base";
import { Geometry } from "../../core/geometry";
import { Texture2D } from "../../objects/textures/texture_2d";
import {
  Channel,
  ChannelProps,
  validateChannel,
} from "../../objects/textures/channel";

export class ScalarImageRenderable extends ImageRenderableBase {
  private texture_: Texture2D;
  private channel_: Required<Channel>;

  constructor(
    geometry: Geometry,
    texture: Texture2D,
    channelProps: ChannelProps = {}
  ) {
    super();
    this.geometry = geometry;
    this.texture_ = texture;
    this.addTexture(texture);
    this.channel_ = validateChannel(texture, channelProps);
    this.programName =
      texture.dataType === "float" ? "floatImage" : "uintImage";
  }

  public get type() {
    return "ScalarImageRenderable";
  }

  public setChannelProps(channelProps: ChannelProps) {
    this.channel_ = validateChannel(this.texture_, channelProps);
  }

  public setChannelProperty<K extends keyof ChannelProps>(
    property: K,
    value: Required<ChannelProps>[K]
  ) {
    const newChannel = validateChannel(this.texture_, {
      ...this.channel_,
      [property]: value,
    });
    this.channel_ = newChannel;
  }

  public override getUniforms() {
    const { color, contrastLimits } = this.channel_;
    return {
      Color: color.rgb,
      ValueOffset: -contrastLimits[0],
      ValueScale: 1 / (contrastLimits[1] - contrastLimits[0]),
    };
  }
}
