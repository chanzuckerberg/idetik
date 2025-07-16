import { ImageRenderableBase } from "./image_renderable_base";
import { Geometry } from "../../core/geometry";
import { Texture2D } from "../../objects/textures/texture_2d";
import {
  Channel,
  ChannelProps,
  validateChannel,
} from "../../objects/textures/channel";

export class ScalarImageRenderable extends ImageRenderableBase {
  private channel_: Required<Channel>;

  constructor(
    geometry: Geometry,
    texture: Texture2D,
    channelProps: ChannelProps = {}
  ) {
    super();
    if (geometry) {
      this.geometry = geometry;
    }
    if (texture) {
      this.addTexture(texture);
    }
    this.channel_ = validateChannel(texture, channelProps);
  }

  public get type() {
    return "ScalarImageRenderable";
  }

  public addTexture(texture: Texture2D) {
    super.addTexture(texture);
    this.setProgramName();
  }

  public setChannelProps(channelProps: ChannelProps) {
    this.channel_ = validateChannel(
      this.textures[0] as Texture2D,
      channelProps
    );
  }

  public setChannelProperty<K extends keyof ChannelProps>(
    property: K,
    value: Required<ChannelProps>[K]
  ) {
    const newChannel = validateChannel(this.textures[0] as Texture2D, {
      ...this.channel_,
      [property]: value,
    });
    this.channel_ = newChannel;
  }

  public override getUniforms() {
    const texture = this.textures[0] as Texture2D;
    if (!texture) {
      throw new Error("No texture set");
    }
    const { color, contrastLimits } = this.channel_;
    return {
      Color: color.rgb,
      ValueOffset: -contrastLimits[0],
      ValueScale: 1 / (contrastLimits[1] - contrastLimits[0]),
    };
  }

  private setProgramName() {
    const texture = this.textures[0] as Texture2D;
    if (!texture) {
      throw new Error("un-textured image not implemented");
    }
    this.programName =
      texture.dataType === "float" ? "floatImage" : "uintImage";
  }
}
