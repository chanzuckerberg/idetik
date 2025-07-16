import { RenderableObject } from "../../core/renderable_object";
import { ChannelProps } from "../textures/channel";

export abstract class ImageRenderableBase extends RenderableObject {
  public abstract setChannelProps(
    channelProps: ChannelProps | ChannelProps[]
  ): void;
}
