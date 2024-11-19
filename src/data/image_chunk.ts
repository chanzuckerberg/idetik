import { Box, Region } from "data/region";
import { TextureUnpackRowAlignment } from "objects/textures/texture";

// One 2D chunk of n-dimensional image data.
// TODO: include the region of this chunk.
// https://github.com/chanzuckerberg/imaging-active-learning/issues/34
export type ImageChunk = {
  data: Uint8Array | Uint16Array;
  shape: number[];
  stride: number[];
  region: Box;
  indices: Box;
  rowAlignmentBytes: TextureUnpackRowAlignment;
};

export type ImageChunkSource = {
  open(): Promise<ImageChunkLoader>;
};

export type ImageChunkData = {
  data: Uint8Array | Uint16Array;
  shape: number[];
  region: Box;
};

export type ImageChunkLoader = {
  emptyData(input: Region): Promise<ImageChunk>;
  loadChunk(input: Region): Promise<ImageChunk>;
  loadChunks(input: Region): AsyncGenerator<ImageChunk>;
};
