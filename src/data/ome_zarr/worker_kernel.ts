/// <reference lib="webworker" />

import * as zarr from "zarrita";
import { createZarrLocation, openArray, ZarrArrayParams } from "../zarr/open";
import { isChunkData, ChunkData } from "../chunk";
import { SliceSpec, processChunk } from "./chunk_processing";

type ZarrWorkerMessageType = "getChunk" | "cancel";

export type ZarrWorkerRequest = {
  id: number;
} & (
  | {
      type: "getChunk";
      arrayParams: ZarrArrayParams;
      index: number[];
      sliceSpec: SliceSpec;
    }
  | {
      type: "cancel";
    }
);

export type ZarrWorkerResponse = {
  id: number;
} & (
  | {
      success: true;
      type: "getChunk";
      data: ChunkData;
    }
  | {
      success: false;
      type: ZarrWorkerMessageType;
      error: string;
    }
);

const arrayCache = new Map<
  string,
  Promise<zarr.Array<zarr.DataType, zarr.Readable>>
>();
const locationCache = new Map<number, zarr.Location<zarr.Readable>>();
const ARRAY_CACHE_LIMIT = 100;
const activeRequests = new Map<number, AbortController>();

self.addEventListener("message", async (e: MessageEvent<ZarrWorkerRequest>) => {
  const { id, type } = e.data;

  try {
    if (type === "getChunk") {
      const { arrayParams, index, sliceSpec } = e.data;
      await handleGetChunkMessage(id, arrayParams, index, sliceSpec);
    } else if (type === "cancel") {
      await handleCancelMessage(id);
    } else {
      throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

async function handleCancelMessage(id: number): Promise<void> {
  const abortController = activeRequests.get(id);
  if (abortController) {
    abortController.abort();
    activeRequests.delete(id);
  }
}

async function handleGetChunkMessage(
  id: number,
  arrayParams: ZarrArrayParams,
  index: number[],
  sliceSpec: SliceSpec
): Promise<void> {
  const abortController = new AbortController();
  activeRequests.set(id, abortController);

  const fetchStart = performance.now();
  let chunk;
  try {
    const array = await getOrOpenArray(arrayParams);
    chunk = await array.getChunk(index, { signal: abortController.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Operation was canceled");
    }
    throw new Error(
      `Failed to get chunk at index ${JSON.stringify(index)}: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    activeRequests.delete(id);
  }
  performance.measure("zarrFetch", { start: fetchStart });

  if (!isChunkData(chunk.data)) {
    throw new Error(
      `Unsupported chunk data type: ${chunk.data.constructor.name}`
    );
  }

  const sliceStart = performance.now();
  const data = processChunk(chunk.data, chunk.shape, chunk.stride, sliceSpec);
  performance.measure("processChunk", { start: sliceStart });

  try {
    self.postMessage({ id, success: true, type: "getChunk", data }, [
      data.buffer,
    ]);
  } catch (postError) {
    throw new Error(
      `Failed to send result: ${postError instanceof Error ? postError.message : String(postError)}`
    );
  }
}

// Reuse each archive's directory across resolution levels in this worker.
function getOrCreateRootLocation(
  params: ZarrArrayParams
): zarr.Location<zarr.Readable> {
  let location = locationCache.get(params.sourceId);
  if (location) {
    locationCache.delete(params.sourceId);
  } else {
    if (locationCache.size >= ARRAY_CACHE_LIMIT) {
      const firstId = locationCache.keys().next().value;
      if (firstId !== undefined) locationCache.delete(firstId);
    }
    location = createZarrLocation(params);
  }
  locationCache.set(params.sourceId, location);
  return location;
}

// Cache in-flight opens too: concurrent chunks must share the same array.
function getOrOpenArray(
  params: ZarrArrayParams
): Promise<zarr.Array<zarr.DataType, zarr.Readable>> {
  const cacheKey = `${params.sourceId}::${params.arrayPath}`;
  let array = arrayCache.get(cacheKey);
  if (array) {
    arrayCache.delete(cacheKey);
    arrayCache.set(cacheKey, array);
    return array;
  }
  if (arrayCache.size >= ARRAY_CACHE_LIMIT) {
    const firstKey = arrayCache.keys().next().value;
    if (firstKey !== undefined) arrayCache.delete(firstKey);
  }
  const location = getOrCreateRootLocation(params);
  array = openArray(location.resolve(params.arrayPath), params.zarrVersion);
  arrayCache.set(cacheKey, array);
  // A failed open must not poison subsequent requests for this array.
  void array.catch(() => {
    if (arrayCache.get(cacheKey) === array) arrayCache.delete(cacheKey);
  });
  return array;
}
