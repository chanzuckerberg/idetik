// Executes a limited number of promises concurrently.
export class PromiseScheduler<T> {
  private readonly maxConcurrent_: number;
  private readonly pending_: Array<() => Promise<void>> = [];
  private readonly abortController_ = new AbortController();
  private numRunning_ = 0;

  constructor(maxConcurrent: number) {
    if (maxConcurrent <= 0) {
      throw Error(`maxConcurrent (${maxConcurrent}) must be positive`);
    }
    this.maxConcurrent_ = maxConcurrent;
  }

  async submit(task: () => Promise<T>): Promise<T> {
    this.abortController_.signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const promise = async () => {
        try {
          this.abortController_.signal.throwIfAborted();
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.numRunning_--;
          this.maybeRunNext();
        }
      };
      this.pending_.push(promise);
      this.maybeRunNext();
    });
  }

  private maybeRunNext(): void {
    if (this.numRunning_ >= this.maxConcurrent_) return;
    const promise = this.pending_.shift();
    if (promise === undefined) return;
    this.numRunning_++;
    promise();
  }

  get abortSignal() {
    return this.abortController_.signal;
  }

  shutdown() {
    console.debug(`Cancelling ${this.pending_.length} tasks.`);
    this.abortController_.abort("shutdown");
  }

  get numRunning() {
    return this.numRunning_;
  }

  get numPending() {
    return this.pending_.length;
  }
}
