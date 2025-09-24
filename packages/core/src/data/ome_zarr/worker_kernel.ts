/// <reference lib="webworker" />

import * as zarr from "zarrita";
import { Readable } from "@zarrita/storage";
import { openArrayFromParams, ZarrArrayParams } from "../zarr/open";
import { ChunkData, isChunkData } from "../chunk";

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
      data: ArrayBuffer;
      shape: number[];
      dtype: string;
      stride: number[];
    }
  | {
      success: true;
      type: "cancel";
    }
  | {
      success: false;
      type: ZarrWorkerMessageType;
      error: string;
    }
);

const arrayCache = new Map<string, zarr.Array<zarr.DataType, Readable>>();
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
  self.postMessage({
    id,
    success: false,
    error: "Operation was cancelled",
  });
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
      throw new Error("Operation was cancelled");
    }
    throw new Error(
      `Failed to get chunk at index ${JSON.stringify(index)}: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    activeRequests.delete(id);
  }

  if (!isChunkData(chunk.data)) {
    throw new Error(`Expected ChunkData, got ${typeof chunk.data}`);
  }
  const { transferableBuffer, dataTypeName } = getTransferableBuffer(
    chunk.data
  );

  try {
    self.postMessage(
      {
        id,
        success: true,
        type: "getChunk",
        data: transferableBuffer,
        shape: chunk.shape,
        dtype: dataTypeName,
        stride: chunk.stride,
      },
      [transferableBuffer]
    );
  } catch (postError) {
    throw new Error(
      `Failed to send result: ${postError instanceof Error ? postError.message : String(postError)}`
    );
  }
}

// we need to open arrays in each worker since we can't transfer them
// workers cache opened arrays to avoid reopening for each chunk request
// this cache is unbounded, but the objects are small and we don't expect
// many different arrays to be used simultaneously in practice
async function getOrOpenArray(
  params: ZarrArrayParams
): Promise<zarr.Array<zarr.DataType, Readable>> {
  const cacheKey = getArrayCacheKey(params);
  let array = arrayCache.get(cacheKey);
  if (!array) {
    try {
      array = await openArrayFromParams(params);
      arrayCache.set(cacheKey, array);
    } catch (openError) {
      throw new Error(
        `Failed to open zarr array: ${openError instanceof Error ? openError.message : String(openError)}`
      );
    }
  }
  return array;
}

function getArrayCacheKey(params: ZarrArrayParams): string {
  return `${params.type}::${JSON.stringify(params.storeConfig)}::${params.arrayPath}`;
}

function getTransferableBuffer(chunkData: ChunkData): {
  transferableBuffer: ArrayBuffer;
  dataTypeName: string;
} {
  let transferableBuffer: ArrayBuffer;
  let dataTypeName: string;
  try {
    const data = chunkData;
    dataTypeName = data.constructor.name;

    // zero-copy transfer the underlying ArrayBuffer directly if possible (data is entire buffer)
    if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
      transferableBuffer = data.buffer;
    } else {
      transferableBuffer = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      );
    }
  } catch (error) {
    throw new Error(
      `Failed to prepare transferable data: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return { transferableBuffer, dataTypeName };
}
