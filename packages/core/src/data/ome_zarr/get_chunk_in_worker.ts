import * as zarr from "zarrita";
import { Readable } from "@zarrita/storage";
import { ChunkData, createChunkData, isChunkData } from "../chunk";
import { Logger } from "../../utilities/logger";
import { ZarrArrayParams } from "../zarr/open";
import { ZarrWorkerRequest, ZarrWorkerResponse } from "./worker_kernel";

type PendingGetChunkRequest = {
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

let worker: Worker | null = null;
let messageId = 0;
const pendingMessages = new Map<number, PendingGetChunkRequest>();
const canceledMessages = new Set<number>();
let workerInitialized = false;

function handleWorkerMessage(e: MessageEvent<ZarrWorkerResponse>): void {
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

  if (success && e.data.type === "getChunk") {
    const { data, shape, stride, dtype } = e.data;
    const chunkData = createChunkData(data, dtype);
    pending.resolve({
      data: chunkData,
      shape,
      stride,
      dtype,
    });
  } else if (!success) {
    pending.reject(new Error(e.data.error || "Unknown worker error"));
  }
}

function handleWorkerError(error: ErrorEvent | MessageEvent): void {
  if (error instanceof MessageEvent) {
    Logger.error(
      "ZarrWorker",
      "Message serialization error occurred - worker remains active"
    );
    return;
  }

  Logger.error(
    "ZarrWorker",
    `Worker failed - canceling ${pendingMessages.size} in-flight messages and recreating worker`,
    error.message
  );

  for (const [_id, pending] of pendingMessages.entries()) {
    pending.reject(new Error(`Worker error: ${error.message}`));
  }
  pendingMessages.clear();

  if (worker) {
    worker.terminate();
    worker = null;
  }

  try {
    createWorker();
    Logger.debug("ZarrWorker", "Replacement worker created successfully");
  } catch (err) {
    Logger.error("ZarrWorker", "Failed to create replacement worker", err);
    workerInitialized = false;
  }
}

function createWorker(): Worker {
  const newWorker = new Worker(new URL("./worker_kernel.ts", import.meta.url), {
    type: "module",
  });

  newWorker.addEventListener("message", handleWorkerMessage);
  newWorker.addEventListener("error", handleWorkerError);
  newWorker.addEventListener("messageerror", handleWorkerError);

  worker = newWorker;
  return newWorker;
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
    if (!worker) {
      reject(new Error("WebWorker not available"));
      return;
    }

    const id = messageId++;
    const pending: PendingGetChunkRequest = {
      resolve,
      reject,
    };
    pendingMessages.set(id, pending);

    // set up cancellation in the worker thread if an AbortSignal is provided
    if (options?.signal) {
      const abortListener = () => {
        if (worker) {
          worker.postMessage({
            id: id,
            type: "cancel",
          } as ZarrWorkerRequest);
        }

        pendingMessages.delete(id);
        canceledMessages.add(id);
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

    worker.postMessage({
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

export function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  pendingMessages.clear();
  workerInitialized = false;
}

export function ensureWorker(): void {
  if (workerInitialized && worker) return;

  try {
    createWorker();
    Logger.debug("ZarrWorker", "Initialized single worker");
    workerInitialized = true;
  } catch {
    Logger.warn("ZarrWorker", "Failed to create worker");
    workerInitialized = false;
    return;
  }
}
