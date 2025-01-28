import { DataTexture2D } from "objects/textures/data_texture_2d";
import { Texture } from "objects/textures/texture";
import { Texture2DArray } from "objects/textures/texture_2d_array";
import { ImageChunk } from "data/image_chunk";
import { PlaneGeometry } from "objects/geometry/plane_geometry";
import { Mesh } from "objects/renderable/mesh";
import { TextureChannelProps } from "objects/textures/texture_channel";

export function makeImageTexture(
  chunk: ImageChunk,
  channel?: TextureChannelProps
) {
  const texture = new DataTexture2D(chunk.data, chunk.shape.x, chunk.shape.y);
  texture.unpackRowLength = chunk.rowStride;
  texture.unpackAlignment = chunk.rowAlignmentBytes;
  if (channel) {
    texture.channel = channel;
  }
  return texture;
}

export function makeImageTextureArray(
  chunk: ImageChunk,
  channelProps?: TextureChannelProps[]
) {
  const texture = new Texture2DArray(chunk.data, chunk.shape.x, chunk.shape.y);
  texture.unpackRowLength = chunk.rowStride;
  texture.unpackAlignment = chunk.rowAlignmentBytes;
  if (channelProps) {
    texture.channels = channelProps;
  }
  return texture;
}

export function makeImageMesh(chunk: ImageChunk, texture: Texture) {
  const plane = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);
  const mesh = new Mesh(plane, texture);
  mesh.transform.scale([chunk.scale.x, chunk.scale.y, 1]);
  mesh.transform.translate([chunk.offset.x, chunk.offset.y, 0]);
  return mesh;
}
