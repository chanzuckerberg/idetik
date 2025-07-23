import { Location, open as zarritaOpen } from "@zarrita/core";
import { AbsolutePath, FetchStore } from "@zarrita/storage";
import { OmeZarrImageLoader } from "../data/ome_zarr_image_loader";
import WebFileSystemStore from "./zarrita/web_file_system_store";

/** Opens an OME-Zarr multiscale image Zarr group from either a URL or local directory. */
export class OmeZarrImageSource {
  private readonly location_: Location<FetchStore | WebFileSystemStore>;

  /**
   * @param url URL of Zarr root
   */
  constructor(url: string);
  /**
   * @param directory return value of `window.showDirectoryPicker()` which gives the browser
   *    permission to access a directory (only works in Chrome/Edge)
   * @param path path to image (begins with "/")
   */
  constructor(directory: FileSystemDirectoryHandle, path?: AbsolutePath);
  constructor(source: string | FileSystemDirectoryHandle, path?: AbsolutePath) {
    this.location_ =
      typeof source === "string"
        ? new Location(new FetchStore(source))
        : new Location(new WebFileSystemStore(source), path);
  }

  async open(): Promise<OmeZarrImageLoader> {
    const root = await zarritaOpen.v2(this.location_, { kind: "group" });
    return new OmeZarrImageLoader(root);
  }
}
