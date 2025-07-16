import { ImageChunk } from "../../data/image_chunk";
import { PlaneGeometry } from "../geometry/plane_geometry";
import { ChannelProps } from "../textures/channel";
import { Texture2D } from "../textures/texture_2d";
import { Texture2DArray } from "../textures/texture_2d_array";
import { ArrayImageRenderable } from "./array_image_renderable";
import { ScalarImageRenderable } from "./scalar_image_renderable";

export function imageRenderableFromChunk(
  chunk: ImageChunk,
  channelProps?: ChannelProps[]
) {
  const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);

  let image: ScalarImageRenderable | ArrayImageRenderable;

  if (chunk.shape.c === 1) {
    const texture = Texture2D.createWithImageChunk(chunk);
    image = new ScalarImageRenderable(geometry, texture, channelProps?.[0]);
  } else {
    const texture = Texture2DArray.createWithImageChunk(chunk);
    image = new ArrayImageRenderable(geometry, texture, channelProps);
  }

  image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
  image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
  return image;
}
