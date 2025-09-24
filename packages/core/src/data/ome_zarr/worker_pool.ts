import * as zarr from "zarrita";
import { Readable } from "@zarrita/storage";
import { ChunkData, createChunkData, isChunkData } from "../chunk";
import { Logger } from "../../utilities/logger";
import { ZarrArrayParams } from "../zarr/open";
import { ZarrWorkerRequest, ZarrWorkerResponse } from "./worker_kernel";

type PendingRequest = {
  resolve: (value: {
    data: ChunkData;
    shape: number[];
    stride: number[];
    dtype: string;
  }) => void;
  reject: (error: Error) => void;
  abortListener?: () => void;
  abortSignal?: AbortSignal;
};

type WorkerInstance = {
  worker: Worker;
  busy: boolean;
  pendingCount: number;
};

const DEFAULT_WORKER_COUNT = Math.min(navigator.hardwareConcurrency || 4, 8);
let workerPool: WorkerInstance[] = [];
let messageId = 0;
const pendingMessages = new Map<number, PendingRequest>();
let poolConfigured = false;

function getWorkerInstance(worker: Worker): WorkerInstance | undefined {
  const instance = workerPool.find((w) => w.worker === worker);
  if (!instance) {
    Logger.error(
      "ZarrWorker",
      "Worker not found in pool - this should not happen"
    );
  }
  return instance;
}

function handleWorkerMessage(
  e: MessageEvent<ZarrWorkerResponse>,
  worker: Worker
): void {
  const { id, success } = e.data;
  const pending = pendingMessages.get(Number(id));

  if (!pending) {
    Logger.warn(
      "ZarrWorker",
      `Received response for unknown message ID ${id} (type: ${e.data.type}, success: ${success})`
    );
    return;
  }

  pendingMessages.delete(Number(id));

  if (pending.abortListener && pending.abortSignal) {
    pending.abortSignal.removeEventListener("abort", pending.abortListener);
  }

  const workerInstance = getWorkerInstance(worker);
  if (workerInstance && workerInstance.pendingCount > 0) {
    workerInstance.pendingCount--;
    workerInstance.busy = workerInstance.pendingCount > 0;
  } else if (workerInstance) {
    Logger.error(
      "ZarrWorker",
      "Received message but no pending tasks - this should not happen"
    );
  }

  if (success && e.data.type === "getChunk") {
    const { data, shape, stride, dtype } = e.data;
    const chunkData = createChunkData(data, dtype);
    pending.resolve({
      data: chunkData,
      shape,
      stride,
      dtype,
    });
  } else if (success && e.data.type === "cancel") {
    Logger.debug(
      "ZarrWorker",
      `Worker acknowledged cancellation of message ID ${id}`
    );
  } else if (!success) {
    pending.reject(new Error(e.data.error || "Unknown worker error"));
  }
}

function handleWorkerError(
  error: ErrorEvent | MessageEvent,
  worker: Worker
): void {
  if (error instanceof MessageEvent) {
    Logger.error(
      "ZarrWorker",
      "Message serialization error occurred - worker remains active"
    );
    return;
  }

  Logger.error(
    "ZarrWorker",
    `Worker failed - replacing worker and canceling ${pendingMessages.size} in-flight messages`,
    error.message
  );

  const workerInstance = getWorkerInstance(worker);
  if (workerInstance) {
    const workerIndex = workerPool.indexOf(workerInstance);
    workerPool.splice(workerIndex, 1);
  }

  for (const [id, pending] of pendingMessages.entries()) {
    pending.reject(new Error(`Worker error: ${error.message}`));
    pendingMessages.delete(id);
  }

  try {
    const replacementWorker = createWorker();
    workerPool.push({
      worker: replacementWorker,
      busy: false,
      pendingCount: 0,
    });
    Logger.debug("ZarrWorker", "Replacement worker created successfully");
  } catch (err) {
    Logger.error("ZarrWorker", "Failed to create replacement worker", err);
  }
}

function createWorker(): Worker {
  const worker = new Worker(new URL("./worker_kernel.ts", import.meta.url), {
    type: "module",
  });

  worker.addEventListener("message", (e) => handleWorkerMessage(e, worker));
  worker.addEventListener("error", (error) => handleWorkerError(error, worker));
  worker.addEventListener("messageerror", (error) =>
    handleWorkerError(error, worker)
  );

  return worker;
}

function getAvailableWorker(): WorkerInstance | undefined {
  if (workerPool.length === 0) return undefined;
  return workerPool.sort((a, b) => a.pendingCount - b.pendingCount)[0];
}

async function getChunkInWorker(
  zarrParams: ZarrArrayParams,
  chunkIndex: number[],
  options?: { signal?: AbortSignal }
): Promise<{
  data: ChunkData;
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
    const pending: PendingRequest = { resolve, reject };
    pendingMessages.set(id, pending);

    // set up cancellation if AbortSignal is provided
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

      pending.abortListener = abortListener;
      pending.abortSignal = options.signal;
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
  data: ChunkData;
  shape: number[];
  stride: number[];
  dtype: string;
}> {
  try {
    return await getChunkInWorker(arrayParams, chunkCoords, options);
  } catch (error) {
    // fall back to main thread on error, unless the operation was aborted
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    Logger.warn("ZarrWorker", "Falling back to main thread", error);
    const chunk = await array.getChunk(chunkCoords, options);

    if (!isChunkData(chunk.data)) {
      throw new Error(
        `Unexpected chunk data type: ${typeof chunk.data}. Expected TypedArray.`
      );
    }

    return {
      data: chunk.data,
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
      `Initialized worker pool with ${workerPool.length} workers`
    );
  } catch {
    Logger.warn("ZarrWorker", "Failed to create workers - clearing pool");
    terminateWorkerPool();
    return;
  }

  poolConfigured = true;
}
