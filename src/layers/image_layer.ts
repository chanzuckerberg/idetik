import { Layer } from "core/layer";
import { ImageSlice } from "objects/renderable/image_slice";
import { ImageSliceSource } from "@/data/ome_zarr_source";

export class ImageLayer extends Layer {
  constructor(source: ImageSliceSource<Uint16Array>) {
    super();

    const imageSlice = new ImageSlice(source);
    this.addObject(imageSlice);
  }
}
