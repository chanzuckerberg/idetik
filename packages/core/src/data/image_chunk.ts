import { Region } from "../data/region";
import { TextureUnpackRowAlignment } from "../objects/textures/texture";
import { PromiseScheduler } from "./promise_scheduler";

const imageChunkDataTypes = [
  Int8Array,
  Int16Array,
  Int32Array,
  Uint8Array,
  Uint16Array,
  Uint32Array,
  Float32Array,
] as const;
type ImageChunkData = InstanceType<(typeof imageChunkDataTypes)[number]>;

export function isImageChunkData(value: unknown): value is ImageChunkData {
  if (
    imageChunkDataTypes.some(
      (ImageChunkData) => value instanceof ImageChunkData
    )
  ) {
    return true;
  }
  const supportedDataTypeNames = imageChunkDataTypes.map((dtype) => dtype.name);
  console.debug(
    `Unsupported image chunk data type: ${value}. Supported data types: ${supportedDataTypeNames}`
  );
  return false;
}

// One 2D chunk of n-dimensional image data.
// TODO: include the region of this chunk.
// https://github.com/chanzuckerberg/idetik/issues/34
export type ImageChunk = {
  data?: ImageChunkData;
  state: "unloaded" | "loading" | "loaded";
  lod: number;
  visible: boolean;
  shape: {
    x: number;
    y: number;
    c: number;
  };
  rowStride: number;
  rowAlignmentBytes: TextureUnpackRowAlignment;
  chunkIndex: {
    x: number;
    y: number;
  };
  scale: {
    x: number;
    y: number;
  };
  offset: {
    x: number;
    y: number;
  };
};

export type ImageChunkSource = {
  open(): Promise<ImageChunkLoader>;
};

// TODO: we should make this more comprehensive, such as for multiscale images, etc.
export type LoaderAttributes = {
  chunks: readonly number[];
  dimensionNames: string[];
  dimensionUnits: (string | undefined)[];
  shape: readonly number[];
  scale: readonly number[];
  translation: readonly number[];
};

export type ImageChunkLoader = {
  loadRegion(
    input: Region,
    lod: number,
    scheduler?: PromiseScheduler
  ): Promise<ImageChunk>;

  loadChunkDataFromRegion(chunk: ImageChunk, region: Region): Promise<void>;

  loadAttributes(): Promise<LoaderAttributes[]>;
};
