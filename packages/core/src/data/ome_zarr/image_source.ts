import { Location } from "@zarrita/core";
import { Readable } from "@zarrita/storage";
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
import { createFetchStore, type AwsCredentials } from "../zarr/s3_fetch_store";

/** Options for customizing fetch requests, such as adding authentication headers for private S3 data */
export type FetchOptions = {
  /** RequestInit overrides to customize fetch behavior (e.g., custom headers for S3 authentication) */
  overrides?: RequestInit;
  /** Whether to use suffix requests for range queries */
  useSuffixRequest?: boolean;
  /** AWS credentials for S3 authentication (will generate signatures per-request) */
  credentials?: AwsCredentials;
  /** AWS region for S3 bucket (e.g., 'us-east-1') */
  region?: string;
};

type OmeZarrImageSourceProps = {
  location: Location<Readable>;
  version?: OmeZarrVersion;
  fetchOptions?: FetchOptions;
};

type HttpOmeZarrImageSourceProps = {
  url: string;
  version?: OmeZarrVersion;
  fetchOptions?: FetchOptions;
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
  readonly fetchOptions?: FetchOptions;

  private constructor(props: OmeZarrImageSourceProps) {
    this.location = props.location;
    this.version = props.version;
    this.fetchOptions = props.fetchOptions;
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
      createZarrArrayParams(
        this.location,
        d.path,
        zarrVersion,
        this.fetchOptions
      )
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

  /**
   * Creates an OmeZarrImageSource from an HTTP(S) URL.
   *
   * @param url URL of Zarr root
   * @param version OME-Zarr version
   * @param fetchOptions Optional fetch configuration (e.g., authentication headers for private S3 data)
   */
  public static fromHttp(props: HttpOmeZarrImageSourceProps) {
    const store = createFetchStore(props.url, props.fetchOptions);
    return new OmeZarrImageSource({
      location: new Location(store),
      version: props.version,
      fetchOptions: props.fetchOptions,
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
