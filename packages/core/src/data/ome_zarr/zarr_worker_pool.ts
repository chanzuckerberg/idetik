import * as zarr from "zarrita";
import { Readable } from "@zarrita/storage";
import { ChunkData, ChunkDataConstructor } from "../chunk";
import { Logger } from "../../utilities/logger";
import { ZarrArrayParams } from "../zarr/open";
import {
  ZarrWorkerRequest,
  ZarrWorkerResponse,
} from "./get_chunk_worker_kernel";

type ZarrChunkData = ArrayBuffer | ChunkData;

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
let poolConfigured = false;

function createWorker(): Worker {
  const worker = new Worker(
    new URL("./get_chunk_worker_kernel.ts", import.meta.url),
    { type: "module" }
  );

  worker.addEventListener("message", (e: MessageEvent<ZarrWorkerResponse>) => {
    const { id, success, data, shape, dtype, stride, error } = e.data;
    const pending = pendingMessages.get(Number(id));

    if (pending) {
      pendingMessages.delete(Number(id));

      if (pending.abortListener && pending.abortSignal) {
        pending.abortSignal.removeEventListener("abort", pending.abortListener);
      }

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
    Logger.error("ZarrWorker", "Worker error", error.message);
    // Remove worker from pool on error
    const workerIndex = workerPool.findIndex((w) => w.worker === worker);
    if (workerIndex >= 0) {
      workerPool.splice(workerIndex, 1);
    }

    for (const [id, pending] of pendingMessages.entries()) {
      pending.reject(new Error(`Worker error: ${error.message}`));
      pendingMessages.delete(id);
    }
  });

  return worker;
}

function getAvailableWorker(): WorkerInstance | null {
  if (workerPool.length === 0) return null;
  return workerPool.sort((a, b) => a.pendingCount - b.pendingCount)[0];
}

function getTypedArrayConstructor(
  constructorName: string
): ChunkDataConstructor {
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

async function getChunkInWorker(
  zarrParams: ZarrArrayParams,
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
        workerInstance.worker.postMessage({
          id: id.toString(),
          type: "cancel",
        } as ZarrWorkerRequest);

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

      const pending = pendingMessages.get(id);
      if (pending) {
        pending.abortListener = abortListener;
        pending.abortSignal = options.signal;
      }
    }

    workerInstance.pendingCount++;
    workerInstance.busy = true;

    workerInstance.worker.postMessage({
      id: id.toString(),
      type: "getChunk",
      arrayParams: zarrParams,
      index: chunkIndex,
    } as ZarrWorkerRequest);
  });
}

// drop-in replacement for zarr.Array.getChunk that dispatches to a WebWorker
export async function getChunk(
  array: zarr.Array<zarr.DataType, Readable>,
  arrayParams: ZarrArrayParams,
  chunkCoords: number[],
  options?: { signal?: AbortSignal }
): Promise<{
  data: ArrayBuffer | ChunkData;
  shape: number[];
  stride: number[];
  dtype: string;
}> {
  try {
    if (workerPool.length === 0) {
      throw new Error("Worker pool not initialized");
    }

    Logger.debug("ZarrWorker", "Using WebWorker for chunk", {
      coords: chunkCoords,
      storeType: arrayParams.storeType,
      arrayPath: arrayParams.arrayPath,
    });

    return await getChunkInWorker(arrayParams, chunkCoords, options);
  } catch (error) {
    Logger.warn("ZarrWorker", "Falling back to main thread", error);
    const chunk = await array.getChunk(chunkCoords, options);

    // make sure we have a typed array (that's all we support)
    if (!ArrayBuffer.isView(chunk.data)) {
      throw new Error(
        `Unexpected chunk data type: ${typeof chunk.data}. Expected TypedArray.`
      );
    }

    return {
      data: chunk.data as ChunkData,
      shape: chunk.shape,
      stride: chunk.stride,
      dtype: chunk.data.constructor.name,
    };
  }
}

export function terminateWorkerPool(): void {
  for (const workerInstance of workerPool) {
    workerInstance.worker.terminate();
  }
  workerPool = [];
  pendingMessages.clear();
  poolConfigured = false;
}

export function ensureWorkerPool(): void {
  if (poolConfigured) return;

  try {
    for (let i = 0; i < DEFAULT_WORKER_COUNT; i++) {
      const worker = createWorker();
      workerPool.push({
        worker,
        busy: false,
        pendingCount: 0,
      });
    }
    Logger.debug(
      "ZarrWorker",
      `Initialized worker pool with ${DEFAULT_WORKER_COUNT} workers`
    );
  } catch {
    Logger.warn("ZarrWorker", "Failed to create workers - clearing pool");
    terminateWorkerPool();
    return;
  }

  poolConfigured = true;
}
