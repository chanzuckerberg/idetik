import * as zarr from "zarrita";
import { OmeZarrImageLoader } from "data/ome_zarr_image_loader";

export class OmeZarrImageSource {
  url_: string;

  constructor(url: string) {
    this.url_ = url;
  }

  // Opens an OME-Zarr multiscale image from the URL of its Zarr group.
  async open(): Promise<OmeZarrImageLoader> {
    const store = new zarr.FetchStore(this.url_);
    const root = await zarr.open.v2(store, { kind: "group" });
    console.debug("opened root ", root, root.attrs);
    return new OmeZarrImageLoader(root);
  }
}
