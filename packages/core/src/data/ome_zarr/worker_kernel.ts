/// <reference lib="webworker" />

import * as zarr from "zarrita";
import { Readable } from "@zarrita/storage";
import { openArrayFromParams, ZarrArrayParams } from "../zarr/open";

type ZarrWorkerMessageType = "getChunk" | "cancel";

export type ZarrWorkerRequest = {
  id: number;
} & (
  | {
      type: "getChunk";
      arrayParams: ZarrArrayParams;
      index: number[];
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
      chunk: zarr.Chunk<zarr.DataType>;
    }
  | {
      success: false;
      type: ZarrWorkerMessageType;
      error: string;
    }
);

const arrayCache = new Map<string, zarr.Array<zarr.DataType, Readable>>();
const ARRAY_CACHE_LIMIT = 100;
const activeRequests = new Map<number, AbortController>();

self.addEventListener("message", async (e: MessageEvent<ZarrWorkerRequest>) => {
  const { id, type } = e.data;

  try {
    if (type === "getChunk") {
      const { arrayParams, index } = e.data;
      await handleGetChunkMessage(id, arrayParams, index);
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
  index: number[]
): Promise<void> {
  const abortController = new AbortController();
  activeRequests.set(id, abortController);

  const array = await getOrOpenArray(arrayParams);

  let chunk;
  try {
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

  if (!ArrayBuffer.isView(chunk.data)) {
    throw new Error(`Expected TypedArray, got ${typeof chunk.data}`);
  }

  try {
    self.postMessage(
      {
        id,
        success: true,
        type: "getChunk",
        chunk,
      },
      [chunk.data.buffer]
    );
  } catch (postError) {
    throw new Error(
      `Failed to send result: ${postError instanceof Error ? postError.message : String(postError)}`
    );
  }
}

// we need to open arrays in each worker since we can't transfer them
// workers cache opened arrays to avoid reopening for each chunk request
// this is a simple LRU cache relying on Map's insertion order to track usage
async function getOrOpenArray(
  params: ZarrArrayParams
): Promise<zarr.Array<zarr.DataType, Readable>> {
  const cacheKey = getArrayCacheKey(params);
  let array = arrayCache.get(cacheKey);
  if (!array) {
    if (arrayCache.size >= ARRAY_CACHE_LIMIT) {
      const firstKey = arrayCache.keys().next().value;
      if (firstKey) arrayCache.delete(firstKey);
    }

    try {
      array = await openArrayFromParams(params);
      arrayCache.set(cacheKey, array);
    } catch (openError) {
      throw new Error(
        `Failed to open zarr array: ${openError instanceof Error ? openError.message : String(openError)}`
      );
    }
  } else {
    arrayCache.delete(cacheKey);
    arrayCache.set(cacheKey, array);
  }
  return array;
}

function getArrayCacheKey(params: ZarrArrayParams): string {
  const storeKey = params.type === "filesystem" ? params.path : params.url;
  return `${params.type}::${storeKey}::${params.arrayPath}`;
}
