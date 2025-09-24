import * as zarr from "zarrita";
import { Location } from "@zarrita/core";
import { Readable } from "@zarrita/storage";
import FetchStore from "@zarrita/storage/fetch";

export type Version = "v2" | "v3";

export interface ZarrArrayParams {
  storeType: "fetch" | "filesystem";
  storeConfig: {
    url?: string;
    path?: string;
    fetchOptions?: {
      overrides?: {
        mode?: RequestMode;
        credentials?: RequestCredentials;
        headers?: Record<string, string>;
      };
    };
  };
  arrayPath: string;
  zarrVersion: Version;
}

export async function openGroup(
  location: zarr.Location<Readable>,
  version?: Version
): Promise<zarr.Group<Readable>> {
  if (version === "v2") {
    try {
      return zarr.open.v2(location, { kind: "group", attrs: true });
    } catch {
      throw new Error(`Failed to open Zarr v2 group at ${location}`);
    }
  }
  if (version === "v3") {
    try {
      return zarr.open.v3(location, { kind: "group" });
    } catch {
      throw new Error(`Failed to open Zarr v3 group at ${location}`);
    }
  }
  try {
    return zarr.open(location, { kind: "group" });
  } catch {
    throw new Error(`Failed to open Zarr group at ${location}`);
  }
}

export async function openArray(
  location: zarr.Location<Readable>,
  version?: Version
): Promise<zarr.Array<zarr.DataType, Readable>>;
export async function openArray(
  params: ZarrArrayParams
): Promise<zarr.Array<zarr.DataType, Readable>>;
export async function openArray(
  locationOrParams: zarr.Location<Readable> | ZarrArrayParams,
  version?: Version
): Promise<zarr.Array<zarr.DataType, Readable>> {
  // Handle structured parameters
  if ("storeType" in locationOrParams) {
    const params = locationOrParams;
    let rootLocation: Location<Readable>;

    if (params.storeType === "fetch") {
      if (!params.storeConfig.url) {
        throw new Error("Missing URL for fetch store");
      }

      const fetchOptions = params.storeConfig.fetchOptions || {
        overrides: {
          mode: "cors" as RequestMode,
          credentials: "same-origin" as RequestCredentials,
          headers: {
            Accept: "application/octet-stream, application/json, */*",
          },
        },
      };

      rootLocation = new Location(
        new FetchStore(params.storeConfig.url, fetchOptions)
      );
    } else if (params.storeType === "filesystem") {
      if (typeof FileSystemDirectoryHandle === "undefined") {
        throw new Error("FileSystem API not available in this context");
      }

      // This would need to be passed differently for filesystem stores
      throw new Error(
        "Filesystem stores not yet supported in openArray with params"
      );
    } else {
      throw new Error(`Unsupported store type: ${params.storeType}`);
    }

    const arrayLocation = params.arrayPath
      ? rootLocation.resolve(params.arrayPath)
      : rootLocation;

    return openArray(arrayLocation, params.zarrVersion);
  }

  // Handle traditional location + version
  const location = locationOrParams;
  if (version === "v2") {
    try {
      return zarr.open.v2(location, { kind: "array", attrs: false });
    } catch {
      throw new Error(`Failed to open Zarr v2 array at ${location}`);
    }
  }
  if (version === "v3") {
    try {
      return zarr.open.v3(location, { kind: "array" });
    } catch {
      throw new Error(`Failed to open Zarr v3 array at ${location}`);
    }
  }
  try {
    return zarr.open(location, { kind: "array" });
  } catch {
    throw new Error(`Failed to open Zarr array at ${location}`);
  }
}
