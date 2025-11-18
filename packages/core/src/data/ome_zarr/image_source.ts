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
import {
  AuthenticatedFetchStore,
  type AwsCredentials,
  type AwsConfig,
} from "../zarr/authenticated_fetch_store";

/** Options for customizing fetch requests, such as adding authentication headers for private S3 data */
export type FetchOptions = {
  /** RequestInit overrides to customize fetch behavior (e.g., custom headers for S3 authentication) */
  overrides?: RequestInit;
  /** Whether to use suffix requests for range queries */
  useSuffixRequest?: boolean;
  /** AWS credentials for S3 authentication (will generate signatures per-request) */
  credentials?: AwsCredentials;
  /** AWS configuration (region and service) */
  awsConfig?: AwsConfig;
};

/** Opens an OME-Zarr multiscale image Zarr group from either a URL or local directory. */
export class OmeZarrImageSource {
  readonly location: Location<Readable>;
  readonly version?: OmeZarrVersion;
  readonly fetchOptions?: FetchOptions;

  /**
   * @param url URL of Zarr root
   * @param version OME-Zarr version
   * @param fetchOptions Optional fetch configuration (e.g., authentication headers for private S3 data)
   */
  constructor(url: string, version?: OmeZarrVersion, fetchOptions?: FetchOptions);
  /**
   * @param directory return value of `window.showDirectoryPicker()` which gives the browser
   *    permission to access a directory (only works in Chrome/Edge)
   * @param version OME-Zarr version
   * @param path path to image, beginning with "/". This argument allows the application to only
   *    ask the user once for permission to the root directory
   */
  constructor(
    directory: FileSystemDirectoryHandle,
    version?: OmeZarrVersion,
    path?: `/${string}`
  );
  // Implementation signature that handles both overloads above.
  // For URLs: 2nd param can be version or fetchOptions, 3rd param is fetchOptions
  // For FileSystemDirectoryHandle: 2nd param is version, 3rd param is path
  constructor(
    source: string | FileSystemDirectoryHandle,
    versionOrOptions?: OmeZarrVersion | FetchOptions,
    pathOrFetchOptions?: `/${string}` | FetchOptions
  ) {
    // Handle URL constructor: (url, version?, fetchOptions?)
    if (typeof source === "string") {
      const version = typeof versionOrOptions === "string" ? versionOrOptions : undefined;
      const fetchOptions = typeof versionOrOptions === "object"
        ? versionOrOptions
        : (pathOrFetchOptions as FetchOptions | undefined);

      // Use AuthenticatedFetchStore if AWS credentials are provided
      const store = fetchOptions?.credentials && fetchOptions?.awsConfig
        ? new AuthenticatedFetchStore(source, fetchOptions)
        : new FetchStore(source, fetchOptions);

      this.location = new Location(store);
      this.version = version;
      this.fetchOptions = fetchOptions;
    }
    // Handle FileSystemDirectoryHandle constructor: (directory, version?, path?)
    else {
      const version = typeof versionOrOptions === "string" ? versionOrOptions : undefined;
      const path = typeof pathOrFetchOptions === "string" ? pathOrFetchOptions : undefined;

      this.location = new Location(new WebFileSystemStore(source), path);
      this.version = version;
      this.fetchOptions = undefined;
    }
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
      createZarrArrayParams(this.location, d.path, zarrVersion, this.fetchOptions)
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
