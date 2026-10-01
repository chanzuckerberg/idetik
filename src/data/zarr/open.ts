import * as zarr from "zarrita";
import { Location, Readable, FetchStore } from "zarrita";
import ZipFileStore from "@zarrita/storage/zip";
import WebFileSystemStore from "./web_file_system_store";

export type Version = "v2" | "v3";

export type ZarrLocationParams = {
  path: `/${string}`;
} & (
  | {
      type: "http";
      url: string;
      contentLength?: number;
    }
  | {
      type: "file";
      file: Blob;
    }
  | {
      type: "filesystem";
      directoryHandle: FileSystemDirectoryHandle;
    }
);

export type ZarrArrayParams = ZarrLocationParams & {
  sourceId: number;
  arrayPath: string;
  zarrVersion: Version | undefined;
};

class OzxHttpRangeReader {
  constructor(
    private readonly url: string,
    private contentLength?: number
  ) {
    if (
      contentLength !== undefined &&
      (!Number.isSafeInteger(contentLength) || contentLength <= 0)
    ) {
      throw new Error("OZX contentLength must be a positive safe integer");
    }
  }

  async getLength(): Promise<number> {
    if (this.contentLength === undefined) {
      const response = await fetch(this.url, { method: "HEAD" });
      if (!response.ok) {
        throw new Error(
          `OZX HEAD request failed with HTTP ${response.status}; supply contentLength if HEAD is unsupported`
        );
      }
      const header = response.headers.get("content-length");
      const length = Number(header);
      if (
        header === null ||
        !/^\d+$/.test(header) ||
        !Number.isSafeInteger(length) ||
        length <= 0
      ) {
        throw new Error(
          "OZX requires a valid HEAD Content-Length header or an explicit contentLength"
        );
      }
      this.contentLength = length;
    }
    return this.contentLength;
  }

  async read(offset: number, size: number): Promise<Uint8Array<ArrayBuffer>> {
    const end = offset + size;
    if (
      !Number.isSafeInteger(offset) ||
      !Number.isSafeInteger(size) ||
      !Number.isSafeInteger(end) ||
      offset < 0 ||
      size < 0
    ) {
      throw new Error("Invalid OZX byte range");
    }
    if (size === 0) return new Uint8Array(0);
    const length = await this.getLength();
    if (end > length) {
      throw new Error("OZX byte range exceeds content length");
    }
    const response = await fetch(this.url, {
      headers: { Range: `bytes=${offset}-${end - 1}` },
    });
    if (response.status !== 206) {
      throw new Error(
        `OZX requires HTTP byte-range support: expected 206, received ${response.status}`
      );
    }
    const header = response.headers.get("content-range");
    const range = /^bytes (\d+)-(\d+)\/(\d+)$/i.exec(header ?? "");
    if (
      header !== null &&
      (!range ||
        Number(range[1]) !== offset ||
        Number(range[2]) !== end - 1 ||
        Number(range[3]) !== length)
    ) {
      throw new Error("OZX response Content-Range does not match the request");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== size) {
      throw new Error(
        `OZX byte-range response has ${bytes.byteLength} bytes; expected ${size}`
      );
    }
    return bytes;
  }
}

export function createHttpStore(url: string, contentLength?: number): Readable {
  const requestUrl = url.split("#", 1)[0];
  return /\.ozx$/i.test(requestUrl.split("?", 1)[0])
    ? new ZipFileStore(new OzxHttpRangeReader(requestUrl, contentLength))
    : new FetchStore(requestUrl);
}

export function openGroup(
  location: zarr.Location<Readable>,
  version?: Version
): Promise<zarr.Group<Readable>> {
  if (version === "v2") {
    return zarr.open.v2(location, { kind: "group", attrs: true });
  }
  if (version === "v3") {
    return zarr.open.v3(location, { kind: "group" });
  }
  return zarr.open(location, { kind: "group" });
}

export function openArray(
  location: zarr.Location<Readable>,
  version?: Version
): Promise<zarr.Array<zarr.DataType, Readable>> {
  if (version === "v2") {
    return zarr.open.v2(location, { kind: "array", attrs: false });
  }
  if (version === "v3") {
    return zarr.open.v3(location, { kind: "array" });
  }
  return zarr.open(location, { kind: "array" });
}

export function createZarrLocation(
  params: ZarrLocationParams
): Location<Readable> {
  switch (params.type) {
    case "http":
      return new Location(
        createHttpStore(params.url, params.contentLength),
        params.path
      );
    case "file":
      return new Location(ZipFileStore.fromBlob(params.file), params.path);
    case "filesystem":
      return new Location(
        new WebFileSystemStore(params.directoryHandle),
        params.path
      );
  }
}
