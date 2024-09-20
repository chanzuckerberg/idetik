export type ImageDataType = Uint8Array | Uint16Array;

// One 2D chunk of n-dimensional image data.
// TODO: include the region of this chunk.
// https://github.com/chanzuckerberg/imaging-active-learning/issues/34
export interface ImageChunk {
  data: ImageDataType;
  shape: {
    width: number;
    height: number;
  };
  rowLength: number;
}
