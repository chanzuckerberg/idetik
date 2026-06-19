import { Location, Readable, FetchStore } from "zarrita";
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
import { SourceDimensionMap } from "../chunk";

type OmeZarrImageSourceProps = {
  location: Location<Readable>;
  version?: OmeZarrVersion;
  loader: OmeZarrImageLoader;
};

type HttpOmeZarrImageSourceProps = {
  url: string;
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

  private readonly loader_: OmeZarrImageLoader;

  private constructor(props: OmeZarrImageSourceProps) {
    this.location = props.location;
    this.version = props.version;
    this.loader_ = props.loader;
  }

  private static async openLoader(
    location: Location<Readable>,
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
    const arrayParams = metadata.datasets.map((d) =>
      createZarrArrayParams(location, d.path, zarrVersion)
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
    return new OmeZarrImageLoader({ metadata, arrays, arrayParams });
  }

  public getDimensions(): SourceDimensionMap {
    return this.loader_.getSourceDimensionMap();
  }

  public getChannelCount(): number {
    return this.getDimensions().c?.lods[0].size ?? 1;
  }

  public get loader(): OmeZarrImageLoader {
    return this.loader_;
  }

  /**
   * Creates and opens an OmeZarrImageSource from an HTTP(S) URL.
   *
   * @param props.url URL of the Zarr root
   * @param props.version OME-Zarr version
   */
  public static async fromHttp(
    props: HttpOmeZarrImageSourceProps
  ): Promise<OmeZarrImageSource> {
    const location = new Location(new FetchStore(props.url));
    const loader = await OmeZarrImageSource.openLoader(location, props.version);
    return new OmeZarrImageSource({ location, version: props.version, loader });
  }

  /**
   * Creates and opens an OmeZarrImageSource from a local filesystem directory.
   *
   * @param directory return value of `window.showDirectoryPicker()` which gives the browser
   *    permission to access a directory (only works in Chrome/Edge)
   * @param version OME-Zarr version
   * @param path path to image, beginning with "/". This argument allows the application to only
   *    ask the user once for permission to the root directory
   */
  public static async fromFileSystem(
    props: FileSystemOmeZarrImageSourceProps
  ): Promise<OmeZarrImageSource> {
    const location = new Location(
      new WebFileSystemStore(props.directory),
      props.path
    );
    const loader = await OmeZarrImageSource.openLoader(location, props.version);
    return new OmeZarrImageSource({ location, version: props.version, loader });
  }
}
