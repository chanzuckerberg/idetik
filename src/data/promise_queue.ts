type PromiseQueueOptions = {
  numConcurrent?: number;
  idleMs?: number;
};

export class PromiseQueue<T> {
  private pendingTasks_: Array<() => Promise<T>> = [];
  private numConcurrent_: number;
  private idleMs_: number;

  constructor(options: PromiseQueueOptions = {}) {
    const { numConcurrent = 1, idleMs = 100 } = options;
    this.numConcurrent_ = numConcurrent;
    this.idleMs_ = idleMs;
  }

  add(fn: () => Promise<T>): void {
    this.pendingTasks_.push(fn);
  }

  async onIdle(): Promise<T[]> {
    const results: T[] = [];
    while (this.pendingTasks_.length > 0) {
      if (this.numConcurrent_ <= 0) {
        await new Promise((resolve) => setTimeout(resolve, this.idleMs_));
        continue;
      }
      const task = this.pendingTasks_.shift();
      if (task === undefined) continue;
      this.numConcurrent_--;
      const result = await task();
      this.numConcurrent_++;
      results.push(result);
    }
    return results;
  }
}
