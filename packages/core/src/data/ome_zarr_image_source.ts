import * as zarr from "zarrita";
import { OmeZarrImageLoader } from "../data/ome_zarr_image_loader";

// Opens an OME-Zarr multiscale image from the URL of its Zarr group.
export class OmeZarrImageSource {
  private readonly url_: string;

  constructor(url: string) {
    this.url_ = url;
  }

  async open(): Promise<OmeZarrImageLoader> {
    const store = new zarr.FetchStore(this.url_);
    const root = await zarr.open.v2(store, { kind: "group" });
    return new OmeZarrImageLoader(root);
  }
}
