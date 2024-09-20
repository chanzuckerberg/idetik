export const imageDataTypes = [Uint8Array, Uint16Array] as const;
export const imageDataTypeNames = imageDataTypes.map(
  (DataType) => DataType.name
);
export type ImageDataType = InstanceType<(typeof imageDataTypes)[number]>;

export function isImageDataType(value: unknown): value is ImageDataType {
  return imageDataTypes.some((DataType) => value instanceof DataType);
}

// One 2D chunk of n-dimensional image data.
// TODO: include the region of this chunk.
// https://github.com/chanzuckerberg/imaging-active-learning/issues/34
export interface ImageChunk {
  data: ImageDataType;
  shape: {
    width: number;
    height: number;
  };
  rowStride: number;
  rowAlignmentBytes: number;
}
