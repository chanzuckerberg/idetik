import { DataTexture2D } from "objects/textures/data_texture_2d";
import { Texture } from "objects/textures/texture";
import { Texture2DArray } from "objects/textures/texture_2d_array";
import { ImageChunk } from "data/image_chunk";
import { PlaneGeometry } from "objects/geometry/plane_geometry";
import { Mesh } from "objects/renderable/mesh";

export function makeImageTexture(chunk: ImageChunk) {
  const texture = new DataTexture2D(chunk.data, chunk.shape.x, chunk.shape.y);
  updateImageTexture(texture, chunk);
  return texture;
}

export function makeImageTextureArray(chunk: ImageChunk) {
  const texture = new Texture2DArray(chunk.data, chunk.shape.x, chunk.shape.y);
  updateImageTexture(texture, chunk);
  return texture;
}

function updateImageTexture(texture: Texture, chunk: ImageChunk) {
  texture.dataFormat = "scalar";
  if (chunk.data instanceof Uint8Array) {
    texture.dataType = "unsigned_byte";
  } else if (chunk.data instanceof Uint16Array) {
    texture.dataType = "unsigned_short";
  } else if (chunk.data instanceof Float32Array) {
    texture.dataType = "float";
  }
  texture.unpackRowLength = chunk.rowStride;
  texture.unpackAlignment = chunk.rowAlignmentBytes;
}

export function makeImageMesh(
  chunk: ImageChunk,
  texture: Texture,
  contrastLimits?: [number, number]
) {
  const plane = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);
  const mesh = new Mesh(plane, texture, contrastLimits);
  mesh.transform.scale([chunk.scale.x, chunk.scale.y, 1]);
  mesh.transform.translate([chunk.offset.x, chunk.offset.y, 0]);
  return mesh;
}
