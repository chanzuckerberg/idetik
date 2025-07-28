import { Location, open as zarritaOpen } from "@zarrita/core";
import FetchStore from "@zarrita/storage/fetch";
import { OmeZarrImageLoader } from "../data/ome_zarr_image_loader";
import WebFileSystemStore from "./zarrita/web_file_system_store";
import { Readable } from "@zarrita/storage";

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

  async open(): Promise<OmeZarrImageLoader> {
    const root = await zarritaOpen(this.location, { kind: "group" });
    return new OmeZarrImageLoader(root);
  }
}
