/// <reference lib="webworker" />

import * as zarr from "zarrita";
import { Location } from "@zarrita/core";
import { Readable } from "@zarrita/storage";
import FetchStore from "@zarrita/storage/fetch";
import { openArray } from "../zarr/open";

export interface ZarrWorkerRequest {
  id: string;
  type: "getChunk" | "clearCache" | "preload" | "setTestDelay" | "cancel";
  store?: string;
  path?: string;
  index?: number[];
  testDelay?: number;
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

// XXX: remove testing configuration
let workerTestDelayMs = 0;

self.addEventListener("message", async (e: MessageEvent<ZarrWorkerRequest>) => {
  const { id, type, store, path, index, testDelay } = e.data;

  try {
    if (type === "cancel") {
      // Cancel the active request by aborting its controller
      const abortController = activeRequests.get(id);
      if (abortController) {
        abortController.abort();
        activeRequests.delete(id);
      }
      self.postMessage({ id, success: false, error: "Operation was cancelled" });
    } else if (type === "setTestDelay") {
      // Set test delay for this worker
      workerTestDelayMs = testDelay || 0;
      self.postMessage({ id, success: true });
    } else if (type === "getChunk") {
      if (!store || !path || !index) {
        throw new Error("Missing required parameters for getChunk");
      }

      // Create AbortController for this request
      const abortController = new AbortController();
      activeRequests.set(id, abortController);

      // Add test delay in worker (should NOT block main thread)
      const delayToUse = testDelay || workerTestDelayMs;
      if (delayToUse > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayToUse));
      }

      // Create cache key from store + path
      const cacheKey = `${store}::${path}`;

      // Get or create cached array
      let array = arrayCache.get(cacheKey);
      if (!array) {
        try {
          // Create proper zarr store location with CORS-friendly fetch options
          const fetchOptions = {
            overrides: {
              mode: "cors" as RequestMode,
              credentials: "same-origin" as RequestCredentials,
              headers: {
                Accept: "application/octet-stream, application/json, */*",
              },
            },
          };
          const rootLocation = new Location(new FetchStore(store, fetchOptions));
          const arrayLocation = path
            ? rootLocation.resolve(path)
            : rootLocation;

          array = await openArray(arrayLocation, "v2");
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
    } else if (type === "clearCache") {
      // Clear cache for memory management
      arrayCache.clear();
      self.postMessage({ id, success: true });
    } else if (type === "preload") {
      if (!store || !path) {
        throw new Error("Missing required parameters for preload");
      }

      // Preload an array into cache
      const cacheKey = `${store}::${path}`;
      if (!arrayCache.has(cacheKey)) {
        // Create proper zarr store location with CORS-friendly fetch options
        const fetchOptions = {
          overrides: {
            mode: "cors" as RequestMode,
            credentials: "same-origin" as RequestCredentials,
            headers: {
              Accept: "application/octet-stream, application/json, */*",
            },
          },
        };
        const rootLocation = new Location(new FetchStore(store, fetchOptions));
        const arrayLocation = path ? rootLocation.resolve(path) : rootLocation;

        // Try to open with same logic as main thread
        const array = await openArray(arrayLocation);
        arrayCache.set(cacheKey, array);
      }
      self.postMessage({ id, success: true });
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
