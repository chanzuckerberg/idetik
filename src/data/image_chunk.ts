// One 2D chunk of n-dimensional image data occupying some region.
// TODO: include the region of this chunk.
// TODO: support data types other than uint16.
export interface ImageChunk {
  data: Uint16Array;
  shape: {
    width: number;
    height: number;
  };
  rowLength: number;
}
