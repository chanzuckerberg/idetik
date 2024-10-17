import { Region } from "data/region";
import { TextureUnpackRowAlignment } from "objects/textures/texture";

// One 2D chunk of n-dimensional image data.
// TODO: include the region of this chunk.
// https://github.com/chanzuckerberg/imaging-active-learning/issues/34
export type ImageChunk = {
  data: Uint8Array | Uint16Array;
  shape: {
    width: number;
    height: number;
    channels: number;
  };
  rowStride: number;
  rowAlignmentBytes: TextureUnpackRowAlignment;
};

export type ImageChunkSource = {
  open(): Promise<ImageChunkLoader>;
};

export type ImageChunkLoader = {
  loadChunk(input: Region): Promise<ImageChunk>;
};
