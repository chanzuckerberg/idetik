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
import {
  omeZarrToZarrVersion,
  parseOmeZarrImage,
  Version as OmeZarrVersion,
} from "./metadata_loaders";
import { S3FetchStore, type S3FetchStoreProps } from "../zarr/s3_fetch_store";

type OmeZarrImageSourceProps = {
  location: Location<Readable>;
  version?: OmeZarrVersion;
};

type HttpOmeZarrImageSourceProps = {
  url: string;
  version?: OmeZarrVersion;
};

type S3OmeZarrImageSourceProps = S3FetchStoreProps & {
  version?: OmeZarrVersion;
};

type FileSystemOmeZarrImageSourceProps = {
  directory: FileSystemDirectoryHandle;
  version?: OmeZarrVersion;
  path?: `/${string}`;
};

/** Opens an OME-Zarr multiscale image Zarr group from either a URL or local directory. */
export class OmeZarrImageSource {
  readonly location: Location<Readable>;
  readonly version?: OmeZarrVersion;

  private constructor(props: OmeZarrImageSourceProps) {
    this.location = props.location;
    this.version = props.version;
  }

  public async open(): Promise<OmeZarrImageLoader> {
    let zarrVersion = omeZarrToZarrVersion(this.version);
    const root = await openGroup(this.location, zarrVersion);
    const adaptedOmeImage = parseOmeZarrImage(root.attrs);
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
    if (!zarrVersion) {
      zarrVersion = omeZarrToZarrVersion(adaptedOmeImage.originalVersion);
    }
    const arrayParams = metadata.datasets.map((d) =>
      createZarrArrayParams(this.location, d.path, zarrVersion)
    );
    const arrays = await Promise.all(
      arrayParams.map(async (params) => openArrayFromParams(params))
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

  /**
   * Creates an OmeZarrImageSource from an HTTP(S) URL.
   *
   * @param url URL of Zarr root
   * @param version OME-Zarr version
   */
  public static fromHttp(props: HttpOmeZarrImageSourceProps) {
    const store = new FetchStore(props.url);
    return new OmeZarrImageSource({
      location: new Location(store),
      version: props.version,
    });
  }

  /**
   * Creates an OmeZarrImageSource from an S3 HTTP(S) URL.
   *
   * @param url URL of Zarr root
   * @param version OME-Zarr version
   * @param credentials AWS credentials for S3 authentication (will generate signatures per-request)
   * @param region AWS region for S3 bucket (e.g., 'us-east-1')
   * @param overrides RequestInit overrides to customize fetch behavior (e.g., custom headers for S3 authentication)
   * @param useSuffixRequest Whether to use suffix requests for range queries
   */
  public static fromS3(props: S3OmeZarrImageSourceProps) {
    const store = new S3FetchStore(props);
    return new OmeZarrImageSource({
      location: new Location(store),
      version: props.version,
    });
  }

  /**
   * Creates an OmeZarrImageSource from a local filesystem directory.
   *
   * @param directory return value of `window.showDirectoryPicker()` which gives the browser
   *    permission to access a directory (only works in Chrome/Edge)
   * @param version OME-Zarr version
   * @param path path to image, beginning with "/". This argument allows the application to only
   *    ask the user once for permission to the root directory
   */
  public static fromFileSystem(props: FileSystemOmeZarrImageSourceProps) {
    const store = new WebFileSystemStore(props.directory);
    return new OmeZarrImageSource({
      location: new Location(store, props.path),
      version: props.version,
    });
  }
}
