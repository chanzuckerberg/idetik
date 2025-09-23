import { ZarrWorkerRequest, ZarrWorkerResponse } from "./zarr_worker_kernel";
import { ChunkData, ChunkDataConstructor } from "../chunk";

// Type definitions for zarr data types
type ZarrChunkData = ArrayBuffer | ChunkData;

// Global test delay setting
let globalTestDelay = 0;

interface PendingRequest {
  resolve: (value: {
    data: ZarrChunkData;
    shape: number[];
    stride: number[];
    dtype: string;
  }) => void;
  reject: (error: Error) => void;
  abortListener?: () => void;
  abortSignal?: AbortSignal;
}

interface WorkerInstance {
  worker: Worker;
  busy: boolean;
  pendingCount: number;
}

const DEFAULT_WORKER_COUNT = Math.min(navigator.hardwareConcurrency || 4, 8);
let workerPool: WorkerInstance[] = [];
let messageId = 0;
const pendingMessages = new Map<number, PendingRequest>();

function createWorker(): Worker {
  const worker = new Worker(
    new URL("./zarr_worker_kernel.ts", import.meta.url),
    { type: "module" }
  );

  worker.addEventListener("message", (e: MessageEvent<ZarrWorkerResponse>) => {
    const { id, success, data, shape, dtype, stride, error } = e.data;
    const pending = pendingMessages.get(Number(id));

    if (pending) {
      pendingMessages.delete(Number(id));

      // Clean up abort listener if it exists
      if (pending.abortListener && pending.abortSignal) {
        pending.abortSignal.removeEventListener("abort", pending.abortListener);
      }

      // Update worker busy status
      const workerInstance = workerPool.find((w) => w.worker === worker);
      if (workerInstance) {
        workerInstance.pendingCount--;
        workerInstance.busy = workerInstance.pendingCount > 0;
      }

      if (success && data && shape && dtype && stride) {
        // Reconstruct the typed array from the transferred ArrayBuffer
        const typedArrayConstructor = getTypedArrayConstructor(dtype);
        const reconstructedData = new typedArrayConstructor(data);

        pending.resolve({
          data: reconstructedData,
          shape,
          stride,
          dtype,
        });
      } else {
        pending.reject(new Error(error || "Unknown worker error"));
      }
    }
  });

  worker.addEventListener("error", (error) => {
    // remove worker from pool on error
    const workerIndex = workerPool.findIndex((w) => w.worker === worker);
    if (workerIndex >= 0) {
      workerPool.splice(workerIndex, 1);
    }

    for (const [id, pending] of pendingMessages.entries()) {
      // need to reject with an Error, not an ErrorEvent
      pending.reject(new Error(`Worker error: ${error.message}`));
      pendingMessages.delete(id);
    }
  });

  return worker;
}

function initializeWorkerPool(workerCount: number = DEFAULT_WORKER_COUNT) {
  if (workerPool.length > 0) return;

  try {
    for (let i = 0; i < workerCount; i++) {
      const worker = createWorker();
      workerPool.push({
        worker,
        busy: false,
        pendingCount: 0,
      });
    }
  } catch {
    // Failed to create workers - clear pool
    terminateWorkerPool();
  }
}

function getAvailableWorker(): WorkerInstance | null {
  initializeWorkerPool();

  if (workerPool.length === 0) return null;

  let bestWorker = workerPool[0];
  for (const workerInstance of workerPool) {
    if (workerInstance.pendingCount < bestWorker.pendingCount) {
      bestWorker = workerInstance;
    }
  }

  return bestWorker;
}

function terminateWorkerPool() {
  for (const workerInstance of workerPool) {
    workerInstance.worker.terminate();
  }
  workerPool = [];
  pendingMessages.clear();
}

function getTypedArrayConstructor(constructorName: string): ChunkDataConstructor {
  switch (constructorName) {
    case "Int8Array":
      return Int8Array;
    case "Int16Array":
      return Int16Array;
    case "Int32Array":
      return Int32Array;
    case "Uint8Array":
      return Uint8Array;
    case "Uint16Array":
      return Uint16Array;
    case "Uint32Array":
      return Uint32Array;
    case "Float32Array":
      return Float32Array;
    default:
      throw new Error(`Unsupported constructor: ${constructorName}`);
  }
}

/**
 * Get a chunk using the worker pool
 */
export async function getChunkInWorker(
  storeUrl: string,
  arrayPath: string,
  chunkIndex: number[],
  options?: { signal?: AbortSignal }
): Promise<{
  data: ZarrChunkData;
  shape: number[];
  stride: number[];
  dtype: string;
}> {
  return new Promise((resolve, reject) => {
    const workerInstance = getAvailableWorker();
    if (!workerInstance) {
      reject(new Error("WebWorker pool not available"));
      return;
    }

    const id = messageId++;
    pendingMessages.set(id, { resolve, reject });

    // Set up cancellation if AbortSignal is provided
    if (options?.signal) {
      const abortListener = () => {
        // Send cancel message to worker
        workerInstance.worker.postMessage({
          id: id.toString(),
          type: "cancel",
        } as ZarrWorkerRequest);
        
        // Clean up local state
        pendingMessages.delete(id);
        workerInstance.pendingCount--;
        workerInstance.busy = workerInstance.pendingCount > 0;
        
        reject(new DOMException("Operation was aborted", "AbortError"));
      };

      if (options.signal.aborted) {
        abortListener();
        return;
      }

      options.signal.addEventListener("abort", abortListener, { once: true });
      
      // Store the listener so we can clean it up later
      const pending = pendingMessages.get(id);
      if (pending) {
        pending.abortListener = abortListener;
        pending.abortSignal = options.signal;
      }
    }

    // Mark worker as busy
    workerInstance.pendingCount++;
    workerInstance.busy = true;

    workerInstance.worker.postMessage({
      id: id.toString(),
      type: "getChunk",
      store: storeUrl,
      path: arrayPath,
      index: chunkIndex,
      testDelay: globalTestDelay,
    } as ZarrWorkerRequest);
  });
}

/**
 * Preload an array into all workers' caches
 */
export async function preloadArray(
  storeUrl: string,
  arrayPath: string
): Promise<void> {
  initializeWorkerPool();

  if (workerPool.length === 0) {
    throw new Error("WebWorker pool not available");
  }

  // Preload in all workers for maximum cache coverage
  const preloadPromises = workerPool.map((workerInstance) => {
    return new Promise<void>((resolve, reject) => {
      const id = messageId++;
      pendingMessages.set(id, {
        resolve: () => resolve(),
        reject,
      });

      workerInstance.worker.postMessage({
        id: id.toString(),
        type: "preload",
        store: storeUrl,
        path: arrayPath,
      } as ZarrWorkerRequest);
    });
  });

  await Promise.all(preloadPromises);
}

/**
 * Clear all workers' array caches
 */
export async function clearWorkerCache(): Promise<void> {
  if (workerPool.length === 0) {
    return; // No workers, nothing to clear
  }

  // Clear cache in all workers
  const clearPromises = workerPool.map((workerInstance) => {
    return new Promise<void>((resolve, reject) => {
      const id = messageId++;
      pendingMessages.set(id, {
        resolve: () => resolve(),
        reject,
      });

      workerInstance.worker.postMessage({
        id: id.toString(),
        type: "clearCache",
      } as ZarrWorkerRequest);
    });
  });

  await Promise.all(clearPromises);
}

/**
 * Terminate the worker pool (cleanup)
 */
export function terminateWorker(): void {
  terminateWorkerPool();
}

/**
 * Check if worker pool is available
 */
export function isWorkerAvailable(): boolean {
  initializeWorkerPool();
  return workerPool.length > 0;
}

/**
 * Get worker pool statistics
 */
export function getWorkerPoolStats() {
  initializeWorkerPool();
  return {
    totalWorkers: workerPool.length,
    busyWorkers: workerPool.filter((w) => w.busy).length,
    pendingRequests: Array.from(pendingMessages.keys()).length,
    workerLoads: workerPool.map((w, i) => ({
      workerId: i,
      pendingCount: w.pendingCount,
      busy: w.busy,
    })),
  };
}

/**
 * Configure worker pool size (must call before first use)
 */
export function configureWorkerPool(workerCount: number): void {
  if (workerPool.length > 0) {
    terminateWorkerPool();
  }
  initializeWorkerPool(Math.min(Math.max(workerCount, 1), 16)); // Cap between 1-16
}

/**
 * Set test delay for worker operations (for testing)
 */
export function setWorkerTestDelay(delayMs: number): void {
  globalTestDelay = delayMs;
}
