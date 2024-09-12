import { Region } from "data/region";

// One chunk of image data occupying some region.
export interface ImageChunk<ArrayType> {
  region: Region;
  data: ArrayType;
  shape: Array<number>;
  stride: Array<number>;
}
