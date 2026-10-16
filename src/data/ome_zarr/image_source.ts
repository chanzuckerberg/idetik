import { Location, Readable } from "zarrita";
import {
  createZarrLocation,
  openArray,
  openGroup,
  ZarrLocationParams,
} from "../zarr/open";
import { OmeZarrImageLoader } from "./image_loader";
import {
  omeZarrToZarrVersion,
  parseOmeZarrImage,
  Version as OmeZarrVersion,
} from "./metadata_loaders";
import { SourceDimensionMap } from "../chunk";

let nextSourceId = 0;

type OmeZarrImageSourceProps = {
  location: Location<Readable>;
  version?: OmeZarrVersion;
  loader: OmeZarrImageLoader;
};

/**
 * Input to {@link OmeZarrImageSource.fromHttp}.
 */
export type HttpOmeZarrImageSourceProps = {
  /** URL of an OME-Zarr root group or an .ozx archive. */
  url: string;
  /** OME-Zarr version. Detected from metadata when omitted. */
  version?: OmeZarrVersion;
  /** Image path within the store or archive. Defaults to the root. */
  path?: `/${string}`;
  /** Known archive size in bytes, avoiding an HTTP HEAD request. */
  contentLength?: number;
};

/**
 * Input to {@link OmeZarrImageSource.fromFileSystem}.
 */
export type FileSystemOmeZarrImageSourceProps = {
  /** OME-Zarr version. Detected from metadata when omitted. */
  version?: OmeZarrVersion;
  /** Image path within the directory or archive. Defaults to the root. */
  path?: `/${string}`;
} & (
  | {
      /** Directory handle with read permission. */
      directory: FileSystemDirectoryHandle;
      file?: never;
    }
  | {
      /** Local OZX archive, for example a File from an input element. */
      file: Blob;
      directory?: never;
    }
);

/**
 * A multiscale image opened from an OME-Zarr store.
 *
 * Instances are created with {@link fromHttp} or {@link fromFileSystem}
 * rather than the constructor. Both factories read
 * the store's metadata up front so the returned source knows its axes, resolution levels,
 * and channel count. OME-Zarr versions `0.4` and `0.5` are supported and
 * the version is detected from metadata when not given.
 *
 * A source is handed to a layer which streams chunks from it on demand.
 *
 * ```ts
 * const source = await OmeZarrImageSource.fromHttp({
 *   url: "https://example.com/image.ome.zarr",
 * });
 *
 * const layer = new ImageLayer({
 *   source,
 *   sliceCoords: { t: 0, z: 0, c: [0] },
 * });
 * ```
 *
 * @group Data Loading
 */
export class OmeZarrImageSource {
  /** The zarr store location the image was opened from. */
  readonly location: Location<Readable>;
  /** The OME-Zarr version passed at creation if any. */
  readonly version?: OmeZarrVersion;

  private readonly loader_: OmeZarrImageLoader;

  private constructor(props: OmeZarrImageSourceProps) {
    this.location = props.location;
    this.version = props.version;
    this.loader_ = props.loader;
  }

  private static async openLoader(
    location: Location<Readable>,
    locationParams: ZarrLocationParams,
    version?: OmeZarrVersion
  ): Promise<OmeZarrImageLoader> {
    let zarrVersion = omeZarrToZarrVersion(version);
    const root = await openGroup(location, zarrVersion);
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
    const sourceId = nextSourceId++;
    const arrayParams = metadata.datasets.map((dataset) => ({
      ...locationParams,
      sourceId,
      arrayPath: dataset.path,
      zarrVersion,
    }));
    const arrays = await Promise.all(
      metadata.datasets.map((dataset) =>
        openArray(location.resolve(dataset.path), zarrVersion)
      )
    );

    const shape = arrays[0].shape;
    const axes = metadata.axes;
    if (axes.length !== shape.length) {
      throw new Error(
        `Mismatch between number of axes (${axes.length}) and array shape (${shape.length})`
      );
    }
    return new OmeZarrImageLoader({ metadata, arrays, arrayParams });
  }

  private static async fromLocationParams(
    params: ZarrLocationParams,
    version?: OmeZarrVersion
  ): Promise<OmeZarrImageSource> {
    const location = createZarrLocation(params);
    const loader = await OmeZarrImageSource.openLoader(
      location,
      params,
      version
    );
    return new OmeZarrImageSource({ location, version, loader });
  }

  /**
   * Returns per-axis dimension metadata for the image.
   *
   * Each axis entry lists one record per level of detail with its size,
   * chunk size, scale, and translation. Use these to convert between
   * array indices and world coordinates, pick slice coordinates, and
   * frame cameras around the image extent.
   */
  public getDimensions(): SourceDimensionMap {
    return this.loader_.getSourceDimensionMap();
  }

  /**
   * Returns the number of channels in the image.
   */
  public getChannelCount(): number {
    return this.getDimensions().c?.lods[0].size ?? 1;
  }

  /** The chunk loader that streams this image's data. */
  public get loader(): OmeZarrImageLoader {
    return this.loader_;
  }

  /**
   * Opens an OME-Zarr image over HTTP(S), including .ozx archives.
   *
   * Archive URLs must end in .ozx before any query or fragment. The server
   * must support byte-range requests and expose Content-Length to browsers.
   * Pass contentLength when the archive size is known and HEAD is unavailable.
   *
   * @param props - The store URL, optional image path, size, and version.
   */
  public static async fromHttp(
    props: HttpOmeZarrImageSourceProps
  ): Promise<OmeZarrImageSource> {
    return OmeZarrImageSource.fromLocationParams(
      {
        type: "http",
        url: props.url,
        contentLength: props.contentLength,
        path: props.path ?? "/",
      },
      props.version
    );
  }

  /**
   * Opens an OME-Zarr image from a local directory or OZX archive.
   *
   * Pass either a directory handle from `window.showDirectoryPicker()` or
   * a File/Blob containing an OZX archive. Directory handles require browser
   * support for the File System Access API; archive files do not.
   * The optional path selects an image within the directory or archive.
   *
   * @param props - Either a directory or file, optional version, and image path.
   */
  public static async fromFileSystem(
    props: FileSystemOmeZarrImageSourceProps
  ): Promise<OmeZarrImageSource> {
    if ((props.file !== undefined) === (props.directory !== undefined)) {
      throw new Error("Provide either file or directory, but not both");
    }
    const path = props.path ?? "/";
    return OmeZarrImageSource.fromLocationParams(
      props.file !== undefined
        ? { type: "file", file: props.file, path }
        : { type: "filesystem", directoryHandle: props.directory, path },
      props.version
    );
  }
}
