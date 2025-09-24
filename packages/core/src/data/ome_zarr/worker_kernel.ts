/// <reference lib="webworker" />

import * as zarr from "zarrita";
import { Readable } from "@zarrita/storage";
import { openArrayFromParams, ZarrArrayParams } from "../zarr/open";
import { isChunkData } from "../chunk";

type ZarrWorkerMessageType = "getChunk" | "cancel";

export type ZarrWorkerRequest = {
  id: string;
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
  id: string;
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
const activeRequests = new Map<string, AbortController>();

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

async function handleCancelMessage(id: string): Promise<void> {
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
  id: string,
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

  const { transferableBuffer, dataTypeName } = getTransferableBuffer(
    chunk.data
  );

  // send back the result with transferable ArrayBuffer
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
// workers will cache opened arrays to avoid reopening for each chunk request
// this cache can grow without bound, but the objects are small and we don't expect
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

// chunkData can be various types from zarrita (TypedArrays, unknown[], etc.)
// we only support ChunkData (see chunk.ts) and validate at runtime
function getTransferableBuffer(chunkData: unknown): {
  transferableBuffer: ArrayBuffer;
  dataTypeName: string;
} {
  let transferableBuffer: ArrayBuffer;
  let dataTypeName: string;
  try {
    if (!isChunkData(chunkData)) {
      throw new Error(`Expected ChunkData, got ${typeof chunkData}`);
    }
    const data = chunkData;
    dataTypeName = data.constructor.name;

    // transfer the underlying ArrayBuffer directly if possible
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
