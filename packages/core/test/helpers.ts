import { Chunk, type ChunkProps } from "../src/data/chunk";

type ChunkOverrides = Partial<
  Omit<ChunkProps, "shape" | "chunkIndex" | "scale" | "offset">
> & {
  shape?: Partial<ChunkProps["shape"]>;
  chunkIndex?: Partial<ChunkProps["chunkIndex"]>;
  scale?: Partial<ChunkProps["scale"]>;
  offset?: Partial<ChunkProps["offset"]>;
};

export function makeChunk(overrides: ChunkOverrides = {}): Chunk {
  const { shape, chunkIndex, scale, offset, ...rest } = overrides;

  const defaultShape = { x: 256, y: 256, z: 256, c: 1 };
  const defaultChunkIndex = { x: 0, y: 0, z: 0, c: 0, t: 0 };
  const defaultScale = { x: 1, y: 1, z: 1 };
  const defaultOffset = { x: 0, y: 0, z: 0 };

  const mergedShape = { ...defaultShape, ...(shape ?? {}) };
  const mergedChunkIndex = { ...defaultChunkIndex, ...(chunkIndex ?? {}) };
  const mergedScale = { ...defaultScale, ...(scale ?? {}) };
  const mergedOffset = { ...defaultOffset, ...(offset ?? {}) };

  return new Chunk({
    state: "unloaded",
    lod: 0,
    visible: false,
    prefetch: false,
    priority: null,
    orderKey: null,
    rowAlignmentBytes: 1,
    ...rest,
    shape: mergedShape,
    chunkIndex: mergedChunkIndex,
    scale: mergedScale,
    offset: mergedOffset,
  });
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
