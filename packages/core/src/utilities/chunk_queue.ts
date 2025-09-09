import { Chunk } from "@/data/chunk";
import { Logger } from "./logger";

const MAX_CONCURRENT = 8;

type LoaderFn = (signal: AbortSignal) => Promise<void>;

type PendingItem = { chunk: Chunk; fn: LoaderFn };

export class ChunkQueue {
  private readonly maxConcurrent_: number;
  private readonly pending_: PendingItem[] = [];
  private readonly running_ = new Map<
    Chunk,
    { controller: AbortController; promise: Promise<void> }
  >();

  constructor(maxConcurrent = MAX_CONCURRENT) {
    this.maxConcurrent_ = Math.max(1, maxConcurrent);
  }

  enqueue(chunk: Chunk, fn: LoaderFn) {
    if (this.running_.has(chunk)) return;
    if (this.pending_.some((p) => p.chunk === chunk)) return;

    this.pending_.push({ chunk, fn });
    this.pump();
  }

  cancel(chunk: Chunk) {
    const idx = this.pending_.findIndex((p) => p.chunk === chunk);
    if (idx >= 0) {
      this.pending_.splice(idx, 1);
      Logger.debug("ChunkQueue", "Cancelled pending request");
      return;
    }

    const running = this.running_.get(chunk);
    if (running) {
      running.controller.abort();
      Logger.debug("ChunkQueue", "Cancelled fetch request");
    }
  }

  private pump() {
    while (
      this.running_.size < this.maxConcurrent_ &&
      this.pending_.length > 0
    ) {
      this.pending_.sort((a, b) => {
        return (
          (a.chunk.priority ?? Number.MAX_SAFE_INTEGER) -
          (b.chunk.priority ?? Number.MAX_SAFE_INTEGER)
        );
      });
      this.start(this.pending_.shift()!);
    }
  }

  private start(item: PendingItem) {
    const { chunk, fn } = item;
    chunk.state = "loading";

    const controller = new AbortController();
    const promise = Promise.resolve()
      .then(() => fn(controller.signal))
      .then(
        () => {
          if (chunk.state === "loading") chunk.state = "loaded";
          this.running_.delete(chunk);
          this.pump();
        },
        (err) => {
          if (chunk.state === "loading") chunk.state = "unloaded";
          this.running_.delete(chunk);
          this.pump();
          if (err.name !== "AbortError") {
            Logger.error("ChunkQueue", String(err));
          }
        }
      );

    this.running_.set(chunk, { controller, promise });
  }
}
