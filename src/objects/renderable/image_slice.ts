import { RenderableObject } from "core/renderable_object";
import { ImageSliceSource } from "data/ome_zarr_source";

export class ImageSlice extends RenderableObject {
  private source_: ImageSliceSource<Uint16Array>;

  constructor(source: ImageSliceSource<Uint16Array>) {
    super();
    this.source_ = source;
  }

  public get type() {
    return "ImageSlice";
  }

  public get source(): Readonly<ImageSliceSource<Uint16Array>> {
    return this.source_;
  }

  public get index() {
    return this.source_.meshSource.index;
  }
}
