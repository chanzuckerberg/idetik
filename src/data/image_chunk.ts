import { Region } from "data/region";
import { TextureUnpackRowAlignment } from "objects/textures/texture";
import { PromiseScheduler } from "./promise_scheduler";

// One 2D chunk of n-dimensional image data.
// TODO: include the region of this chunk.
// https://github.com/chanzuckerberg/imaging-active-learning/issues/34
export type ImageChunk = {
  data: Uint8Array | Uint16Array;
  rowStride: number;
  rowAlignmentBytes: TextureUnpackRowAlignment;
} & ImageChunkAttributes;

export type ImageChunkAttributes = {
  shape: {
    x: number;
    y: number;
    c: number;
  };
  scale: {
    x: number;
    y: number;
  };
  offset: {
    x: number;
    y: number;
  };
  name: {
    x: string;
    y: string;
  };
};

export type ImageChunkSource = {
  open(): Promise<ImageChunkLoader>;
};

export type ImageChunkLoader = {
  // get shape of the texture in world coordinates
  getChunkAttributes(
    input: Region,
    scaleIndex?: number
  ): Promise<ImageChunkAttributes>;
  loadChunk(
    input: Region,
    scheduler?: PromiseScheduler,
    scaleIndex?: number
  ): Promise<ImageChunk>;
};
