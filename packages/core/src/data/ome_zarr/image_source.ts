import { Location } from "@zarrita/core";
import { Readable } from "@zarrita/storage";
import FetchStore from "@zarrita/storage/fetch";
import {
  openArrayFromParams,
  openGroup,
  createZarrArrayParams,
} from "../zarr/open";
import WebFileSystemStore from "../zarr/web_file_system_store";
import { OmeZarrImageLoader } from "./image_loader";
import { omeZarrToZarrVersion, parseOmeZarrImage } from "./metadata_loaders";

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
    const root = await openGroup(this.location);
    const adaptedOmeImage = parseOmeZarrImage(root.attrs);
    const omeVersion = adaptedOmeImage.originalVersion;
    const images = adaptedOmeImage.multiscales;
    if (images.length !== 1) {
      throw new Error(
        `Exactly one multiscale image is supported. Found ${images.length} images.`
      );
    }
    const metadata = images[0];
    if (metadata.datasets.length === 0) {
      throw new Error(`No datasets found in the multiscale image.`);
    }
    const zarrVersion = omeZarrToZarrVersion(omeVersion);
    const arrayParams = metadata.datasets.map((d) =>
      createZarrArrayParams(this.location, d.path, zarrVersion)
    );
    const arrays = await Promise.all(
      arrayParams.map((params) => openArrayFromParams(params))
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
      arrayParams,
    });
  }
}
