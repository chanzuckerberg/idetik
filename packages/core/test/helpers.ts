import type { Chunk } from "../src/data/chunk";

type ChunkOverrides = Partial<
  Omit<Chunk, "shape" | "chunkIndex" | "scale" | "offset" | "rowStride">
> & {
  shape?: Partial<Chunk["shape"]>;
  chunkIndex?: Partial<Chunk["chunkIndex"]>;
  scale?: Partial<Chunk["scale"]>;
  offset?: Partial<Chunk["offset"]>;
};

export function makeChunk(overrides: ChunkOverrides = {}): Chunk {
  const { shape, chunkIndex, scale, offset, ...rest } = overrides;

  const defaultChunk: Chunk = {
    state: "unloaded",
    lod: 0,
    visible: false,
    prefetch: false,
    priority: null,
    orderKey: null,
    viewStates: new Map(),
    shape: { x: 256, y: 256, z: 256, c: 1 },
    rowStride: 256,
    rowAlignmentBytes: 1,
    chunkIndex: { x: 0, y: 0, z: 0, c: 0, t: 0 },
    scale: { x: 1, y: 1, z: 1 },
    offset: { x: 0, y: 0, z: 0 },
  };

  const mergedShape = { ...defaultChunk.shape, ...(shape ?? {}) };

  return {
    ...defaultChunk,
    ...rest,
    shape: mergedShape,
    chunkIndex: { ...defaultChunk.chunkIndex, ...(chunkIndex ?? {}) },
    scale: { ...defaultChunk.scale, ...(scale ?? {}) },
    offset: { ...defaultChunk.offset, ...(offset ?? {}) },
    rowStride: mergedShape.x,
  };
}

export function makeControllableLoader(onStart?: () => void) {
  const createAbortError = () => {
    const e = new Error("Cancelled");
    e.name = "AbortError";
    return e;
  };

  let _resolve: () => void;
  let _reject: (e: unknown) => void;

  const loader = (signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      _resolve = resolve;
      _reject = reject;
      onStart?.();

      const abort = () => reject(createAbortError());

      if (signal.aborted) {
        abort();
      } else {
        signal.addEventListener("abort", abort, { once: true });
      }
    });

  return {
    loader,
    resolve: () => _resolve?.(),
    reject: (e?: unknown) => _reject?.(e ?? new Error("test rejection")),
  };
}

export async function waitFor(
  check: () => boolean,
  { timeout = 500, interval = 5 } = {}
) {
  const start = Date.now();
  while (true) {
    if (check()) return;
    if (Date.now() - start > timeout) throw new Error("waitFor timeout");
    await new Promise((r) => setTimeout(r, interval));
  }
}
