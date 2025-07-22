import { Location, open as zarritaOpen } from "@zarrita/core";
import { AbsolutePath, FetchStore } from "@zarrita/storage";
import { OmeZarrImageLoader } from "../data/ome_zarr_image_loader";
// import { BlobReader } from "@zarrita/storage/zip";
import WebFileSystemStore from "./zarrita/web_file_system_store";

/** Opens an OME-Zarr multiscale image Zarr group from from either a URL for a local file. */
// export class OmeZarrImageSource {
//   private readonly location_: Location<FetchStore | ZipFileStore<BlobReader>>;

//   constructor(url: string);
//   constructor(file: Blob, path?: AbsolutePath);
//   constructor(source: string | Blob, path?: AbsolutePath) {
//     this.location_ =
//       typeof source === "string"
//         ? new Location(new FetchStore(source))
//         : new Location(ZipFileStore.fromBlob(source), path);
//   }

//   async open(): Promise<OmeZarrImageLoader> {
//     const root = await zarritaOpen.v2(this.location_, { kind: "group" });
//     return new OmeZarrImageLoader(root);
//   }
// }

export class OmeZarrImageSource {
  private readonly location_: Location<FetchStore | WebFileSystemStore>;

  constructor(url: string);
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
