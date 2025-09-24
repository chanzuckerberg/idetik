/// <reference lib="webworker" />

import * as zarr from "zarrita";
import { Readable } from "@zarrita/storage";
import { openArray, ZarrArrayParams } from "../zarr/open";

export interface ZarrWorkerRequest {
  id: string;
  type: "getChunk" | "cancel";
  arrayParams?: ZarrArrayParams;
  index?: number[];
}

export interface ZarrWorkerResponse {
  id: string;
  success: boolean;
  error?: string;
  data?: ArrayBuffer;
  shape?: number[];
  dtype?: string;
  stride?: number[];
}

const arrayCache = new Map<string, zarr.Array<zarr.DataType, Readable>>();
const activeRequests = new Map<string, AbortController>();

self.addEventListener("message", async (e: MessageEvent<ZarrWorkerRequest>) => {
  const { id, type, arrayParams, index } = e.data;

  try {
    if (type === "cancel") {
      // Cancel the active request by aborting its controller
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
    } else if (type === "getChunk") {
      if (!arrayParams || !index) {
        throw new Error("Missing required parameters for getChunk");
      }

      // Create AbortController for this request
      const abortController = new AbortController();
      activeRequests.set(id, abortController);

      // Create cache key from params
      const cacheKey = `${arrayParams.storeType}::${JSON.stringify(arrayParams.storeConfig)}::${arrayParams.arrayPath}`;

      // Get or create cached array
      let array = arrayCache.get(cacheKey);
      if (!array) {
        try {
          array = await openArray(arrayParams);
          arrayCache.set(cacheKey, array);
        } catch (openError) {
          throw new Error(
            `Failed to open zarr array: ${openError instanceof Error ? openError.message : String(openError)}`
          );
        }
      }

      let chunk;
      try {
        // Pass the AbortSignal to getChunk so it can cancel the actual fetch
        chunk = await array.getChunk(index, { signal: abortController.signal });
      } catch (error) {
        // Clean up the active request
        activeRequests.delete(id);

        if (abortController.signal.aborted) {
          throw new Error("Operation was cancelled");
        }
        throw new Error(
          `Failed to get chunk at index ${JSON.stringify(index)}: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Clean up the active request on success
      activeRequests.delete(id);

      let transferableBuffer: ArrayBuffer;
      let dataTypeName: string;
      try {
        // Type assertion since TypeScript can't infer chunk.data is a TypedArray
        const data = chunk.data as ArrayBufferView;
        dataTypeName = data.constructor.name;

        if (data.buffer instanceof ArrayBuffer) {
          transferableBuffer = data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength
          );
        } else {
          const tempArray = new Uint8Array(data.byteLength);
          const sourceView = new Uint8Array(
            data.buffer,
            data.byteOffset,
            data.byteLength
          );
          tempArray.set(sourceView);
          transferableBuffer = tempArray.buffer;
        }
      } catch (error) {
        throw new Error(
          `Failed to prepare transferable data: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Send back the result with transferable ArrayBuffer
      try {
        self.postMessage(
          {
            id,
            success: true,
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
