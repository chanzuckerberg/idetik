export type DType = "uint8" | "uint16";

// One 2D chunk of n-dimensional image data.
// TODO: include the region of this chunk.
// https://github.com/chanzuckerberg/imaging-active-learning/issues/34
// TODO: support data types other than uint16.
// https://github.com/chanzuckerberg/imaging-active-learning/issues/31
export interface ImageChunk {
  data: Uint8Array | Uint16Array;
  dtype: DType;
  shape: {
    width: number;
    height: number;
  };
  rowLength: number;
}
