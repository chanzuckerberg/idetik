import * as zarr from "zarrita";
import { Readable } from "@zarrita/storage";
import { ChunkData, isChunkData } from "../chunk";
import { Logger } from "../../utilities/logger";
import { ZarrArrayParams } from "../zarr/open";
import { ZarrWorkerRequest, ZarrWorkerResponse } from "./worker_kernel";

type PendingGetChunkRequest = {
  resolve: (value: {
    data: ChunkData;
    shape: number[];
    stride: number[];
  }) => void;
  reject: (error: Error) => void;
  abortListener?: () => void;
  abortSignal?: AbortSignal;
  workerId: number;
};

type WorkerInstance = {
  worker: Worker;
  busy: boolean;
  pendingCount: number;
  workerId: number;
};

const DEFAULT_WORKER_COUNT = Math.min(navigator.hardwareConcurrency || 4, 8);
let workerPool: WorkerInstance[] = [];
let messageId = 0;
let workerId = 0;
const pendingMessages = new Map<number, PendingGetChunkRequest>();
const canceledMessages = new Set<number>();
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
  const pending = pendingMessages.get(id);

  if (!pending) {
    if (canceledMessages.has(id)) {
      canceledMessages.delete(id);
    } else {
      Logger.warn(
        "ZarrWorker",
        `Received response for unknown message ID ${id}:`,
        e.data
      );
    }
    return;
  }

  pendingMessages.delete(id);

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
    const { data, shape, stride } = e.data;
    pending.resolve({
      data,
      shape,
      stride,
    });
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

  const failedWorkerId = workerInstance?.workerId;
  if (failedWorkerId !== undefined) {
    for (const [id, pending] of pendingMessages.entries()) {
      if (pending.workerId === failedWorkerId) {
        pending.reject(new Error(`Worker error: ${error.message}`));
        pendingMessages.delete(id);
      }
    }
  }

  try {
    const replacementWorker = createWorker();
    workerPool.push({
      worker: replacementWorker,
      busy: false,
      pendingCount: 0,
      workerId: workerId++,
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
}> {
  return new Promise((resolve, reject) => {
    const workerInstance = getAvailableWorker();
    if (!workerInstance) {
      reject(new Error("WebWorker pool not available"));
      return;
    }

    const id = messageId++;
    const pending: PendingGetChunkRequest = {
      resolve,
      reject,
      workerId: workerInstance.workerId,
    };
    pendingMessages.set(id, pending);

    // set up cancellation in the worker thread if an AbortSignal is provided
    if (options?.signal) {
      const abortListener = () => {
        workerInstance.worker.postMessage({
          id: id,
          type: "cancel",
        } as ZarrWorkerRequest);

        pendingMessages.delete(id);
        canceledMessages.add(id);

        workerInstance.pendingCount--;
        workerInstance.busy = workerInstance.pendingCount > 0;

        reject(new DOMException("Operation was aborted", "AbortError"));
      };

      if (options.signal.aborted) {
        abortListener();
        // delete now, message canceled before it was even posted
        canceledMessages.delete(id);
        return;
      }

      options.signal.addEventListener("abort", abortListener, { once: true });

      pending.abortListener = abortListener;
      pending.abortSignal = options.signal;
    }

    workerInstance.pendingCount++;
    workerInstance.busy = true;

    workerInstance.worker.postMessage({
      id: id,
      type: "getChunk",
      arrayParams: zarrParams,
      index: chunkIndex,
    } as ZarrWorkerRequest);
  });
}

export async function getChunk(
  array: zarr.Array<zarr.DataType, Readable>,
  arrayParams: ZarrArrayParams,
  chunkCoords: number[],
  options?: { signal?: AbortSignal }
): Promise<{
  data: ChunkData;
  shape: number[];
  stride: number[];
}> {
  try {
    return await getChunkInWorker(arrayParams, chunkCoords, options);
  } catch (error) {
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
        workerId: workerId++,
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
