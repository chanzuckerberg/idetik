import * as zarr from "zarrita";
import { Readable } from "@zarrita/storage";
import { ChunkData } from "../chunk";
import {
  getChunkInWorker,
  isWorkerAvailable,
  terminateWorker as terminateZarrWorker,
  getWorkerPoolStats,
  configureWorkerPool,
  setWorkerTestDelay,
} from "./zarr_worker_wrapper";

// XXX: remove testing configuration
let forceMainThread = false;
let testDelayMs = 0;

/**
 * Drop-in replacement for zarr Array.getChunk() that uses a WebWorker for the entire operation.
 * Falls back to main thread if WebWorker is not available or if store info can't be extracted.
 */
export async function getChunk(
  array: zarr.Array<zarr.DataType, Readable>,
  chunkCoords: number[],
  options?: { signal?: AbortSignal }
): Promise<{
  data: ArrayBuffer | ChunkData;
  shape: number[];
  stride: number[];
  dtype: string;
}> {
  const startTime = performance.now();

  // Check if we should force main thread for testing
  const shouldUseWorker = !forceMainThread && isWorkerAvailable();

  if (shouldUseWorker) {
    // Check if already aborted before starting worker operation
    if (options?.signal?.aborted) {
      throw new DOMException('Operation was aborted', 'AbortError');
    }
    
    // Try to extract store information from the zarr array
    const storeInfo = extractStoreInfo(array);

    if (storeInfo) {
      // Debug: log worker usage
      if (
        typeof window !== "undefined" &&
        (window as { __ZARR_DEBUG?: boolean }).__ZARR_DEBUG
      ) {
        // eslint-disable-next-line no-console
        console.log("🔧 Attempting zarr chunk in WebWorker pool", {
          coords: chunkCoords,
          store: storeInfo.storeUrl,
          path: storeInfo.arrayPath,
          poolStats: getWorkerPoolStats(),
          testDelay: testDelayMs > 0 ? `${testDelayMs}ms` : "none",
        });
      }

      // Use worker for the entire getChunk operation
      const result = await getChunkInWorker(
        storeInfo.storeUrl,
        storeInfo.arrayPath,
        chunkCoords,
        options
      );

      // Debug: log timing
      if (
        typeof window !== "undefined" &&
        (window as { __ZARR_DEBUG?: boolean }).__ZARR_DEBUG
      ) {
        // eslint-disable-next-line no-console
        console.log(
          `🔧 WebWorker chunk completed in ${(performance.now() - startTime).toFixed(1)}ms`
        );
      }

      return result;
    }
  }

  // Fallback: use main thread
  if (
    typeof window !== "undefined" &&
    (window as { __ZARR_DEBUG?: boolean }).__ZARR_DEBUG
  ) {
    // eslint-disable-next-line no-console
    console.log("⚠️ Processing on main thread", {
      coords: chunkCoords,
      reason: forceMainThread
        ? "forced for testing"
        : "worker unavailable/no store info",
      testDelay: testDelayMs > 0 ? `${testDelayMs}ms` : "none",
    });
  }

  // Add test delay on main thread (THIS WILL BLOCK THE UI)
  if (testDelayMs > 0) {
    // Use a synchronous busy loop to actually block the main thread
    const startTime = performance.now();
    while (performance.now() - startTime < testDelayMs) {
      // Busy wait - this WILL block the UI thread
    }
  }

  const result = await array.getChunk(chunkCoords, options);

  // Debug: log timing
  if (
    typeof window !== "undefined" &&
    (window as { __ZARR_DEBUG?: boolean }).__ZARR_DEBUG
  ) {
    // eslint-disable-next-line no-console
    console.log(
      `⚠️ Main thread chunk completed in ${(performance.now() - startTime).toFixed(1)}ms`
    );
  }

  return result;
}

/**
 * Extract store URL and array path from a zarr array
 * This is needed to recreate the array in the WebWorker
 */
function extractStoreInfo(array: zarr.Array<zarr.DataType, Readable>): {
  storeUrl: string;
  arrayPath: string;
} | null {
  try {
    // Try to extract store information from the array
    // This depends on the internal structure of zarrita arrays
    const anyArray = array as {
      store?: { url?: string; root?: string } | string;
      path?: string;
      name?: string;
    };

    if (
      typeof window !== "undefined" &&
      (window as { __ZARR_DEBUG?: boolean }).__ZARR_DEBUG
    ) {
      // eslint-disable-next-line no-console
      console.log("🔍 Extracting store info from zarr array", {
        storeType: typeof anyArray.store,
        store: anyArray.store,
        path: anyArray.path,
        name: anyArray.name,
        arrayKeys: Object.keys(anyArray),
      });
    }

    // Check if we can get the store URL
    let storeUrl: string | undefined;
    if (typeof anyArray.store === "string") {
      // Store is directly a URL string
      storeUrl = anyArray.store;
    } else if (typeof anyArray.store === "object" && anyArray.store) {
      // Store is an object, try to extract URL
      if ("url" in anyArray.store && typeof anyArray.store.url === "string") {
        storeUrl = anyArray.store.url;
      } else if (
        "root" in anyArray.store &&
        typeof anyArray.store.root === "string"
      ) {
        storeUrl = anyArray.store.root;
      }
    }

    // Check if we can get the array path
    let arrayPath: string | undefined;
    if (anyArray.path) {
      arrayPath = anyArray.path;
    } else if (anyArray.name) {
      arrayPath = anyArray.name;
    } else {
      // Default path if none specified
      arrayPath = "";
    }

    if (
      typeof window !== "undefined" &&
      (window as { __ZARR_DEBUG?: boolean }).__ZARR_DEBUG
    ) {
      // eslint-disable-next-line no-console
      console.log("🔍 Store extraction result", {
        storeUrl,
        arrayPath,
        success: !!(storeUrl && arrayPath !== undefined),
      });
    }

    if (storeUrl && arrayPath !== undefined) {
      return { storeUrl, arrayPath };
    }

    return null;
  } catch (error) {
    if (
      typeof window !== "undefined" &&
      (window as { __ZARR_DEBUG?: boolean }).__ZARR_DEBUG
    ) {
      // eslint-disable-next-line no-console
      console.log("🔍 Store extraction failed", error);
    }
    return null;
  }
}

/**
 * Get worker status information
 */
export function getWorkerStatus() {
  return {
    workerAvailable: isWorkerAvailable(),
  };
}

/**
 * Enable debug logging for zarr chunk processing
 */
export function enableZarrDebug() {
  if (typeof window !== "undefined") {
    (window as { __ZARR_DEBUG?: boolean }).__ZARR_DEBUG = true;
    // eslint-disable-next-line no-console
    console.log(
      "🐞 Zarr WebWorker debugging enabled. Look for 🔧 and ⚠️ messages."
    );
  }
}

/**
 * Disable debug logging for zarr chunk processing
 */
export function disableZarrDebug() {
  if (typeof window !== "undefined") {
    (window as { __ZARR_DEBUG?: boolean }).__ZARR_DEBUG = false;
  }
}

/**
 * Configure the WebWorker pool size (call before first use for best results)
 */
export function configureZarrWorkerPool(workerCount: number) {
  configureWorkerPool(workerCount);
  if (
    typeof window !== "undefined" &&
    (window as { __ZARR_DEBUG?: boolean }).__ZARR_DEBUG
  ) {
    // eslint-disable-next-line no-console
    console.log(
      `🔧 Configured zarr WebWorker pool with ${workerCount} workers`
    );
  }
}

/**
 * Testing utilities - use these to verify WebWorker vs main thread behavior
 */

/**
 * Force all zarr operations to use main thread (for testing comparison)
 */
export function forceMainThreadMode(enabled: boolean) {
  forceMainThread = enabled;
  if (
    typeof window !== "undefined" &&
    (window as { __ZARR_DEBUG?: boolean }).__ZARR_DEBUG
  ) {
    // eslint-disable-next-line no-console
    console.log(
      `🧪 ${enabled ? "ENABLED" : "DISABLED"} force main thread mode`
    );
  }
}

/**
 * Add artificial delay to chunk operations (for testing)
 * - Main thread delay will BLOCK the UI with busy-wait loop
 * - WebWorker delay will NOT block the UI (uses setTimeout)
 */
export async function setTestDelay(delayMs: number) {
  testDelayMs = delayMs;

  // Set delay for workers too
  setWorkerTestDelay(delayMs);

  if (
    typeof window !== "undefined" &&
    (window as { __ZARR_DEBUG?: boolean }).__ZARR_DEBUG
  ) {
    // eslint-disable-next-line no-console
    console.log(
      `🧪 Set test delay to ${delayMs}ms (main thread will FREEZE with busy-wait, workers won't)`
    );
  }
}

/**
 * Terminate the worker pool when no longer needed
 */
export function terminateWorker() {
  terminateZarrWorker();
}
