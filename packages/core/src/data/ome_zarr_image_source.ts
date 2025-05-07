import * as zarr from "zarrita";
import { OmeZarrImageLoader } from "../data/ome_zarr_image_loader";

// Opens an OME-Zarr multiscale image from the URL of its Zarr group.
export class OmeZarrImageSource {
  private url_: string;
  private scaleIndex_?: number;

  constructor(url: string, scaleIndex?: number) {
    this.url_ = url;
    this.scaleIndex_ = scaleIndex;
  }

  async open(): Promise<OmeZarrImageLoader> {
    const store = new zarr.FetchStore(this.url_);
    const root = await zarr.open.v2(store, { kind: "group" });
    return new OmeZarrImageLoader(root, this.scaleIndex_);
  }
}
