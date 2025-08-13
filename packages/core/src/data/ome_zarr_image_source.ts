import { Location, open as zarritaOpen } from "@zarrita/core";
import FetchStore from "@zarrita/storage/fetch";
import { OmeZarrImageLoader } from "../data/ome_zarr_image_loader";
import WebFileSystemStore from "./zarrita/web_file_system_store";
import { Readable } from "@zarrita/storage";
import { Image as OmeNgffImage } from "../data/ome_ngff/0.4/image";

/** Opens an OME-Zarr multiscale image Zarr group from either a URL or local directory. */
export class OmeZarrImageSource {
  readonly location: Location<Readable>;

  /**
   * @param url URL of Zarr root
   */
  constructor(url: string);
  /**
   * @param directory return value of `window.showDirectoryPicker()` which gives the browser
   *    permission to access a directory (only works in Chrome/Edge)
   * @param path path to image, beginning with "/". This argument allows the application to only
   *    ask the user once for permission to the root directory
   */
  constructor(directory: FileSystemDirectoryHandle, path?: `/${string}`);
  constructor(source: string | FileSystemDirectoryHandle, path?: `/${string}`) {
    this.location =
      typeof source === "string"
        ? new Location(new FetchStore(source))
        : new Location(new WebFileSystemStore(source), path);
  }

  public async open(): Promise<OmeZarrImageLoader> {
    const root = await zarritaOpen.v2(this.location, { kind: "group" });
    const images = OmeNgffImage.parse(root.attrs).multiscales;
    if (images.length !== 1) {
      throw new Error(
        `Exactly one multiscale image is supported. Found ${images.length} images.`
      );
    }
    const metadata = images[0];
    if (metadata.datasets.length === 0) {
      throw new Error(`No datasets found in the multiscale image.`);
    }
    const arrays = await Promise.all(
      metadata.datasets.map((d) =>
        zarritaOpen.v2(root.resolve(d.path), {
          kind: "array",
          attrs: false,
        })
      )
    );
    const shape = arrays[0].shape;
    const axes = metadata.axes;
    if (axes.length !== shape.length) {
      throw new Error(
        `Mismatch between number of axes (${axes.length}) and array shape (${shape.length})`
      );
    }
    return new OmeZarrImageLoader({
      metadata,
      arrays,
    });
  }
}
