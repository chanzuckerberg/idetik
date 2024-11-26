export class PromiseQueue<T> {
  private readonly numConcurrent_: number;
  private pendingTasks_: Array<() => Promise<T>> = [];
  private runningTasks_: Array<Promise<T>> = [];

  constructor(numConcurrent: number = 16) {
    this.numConcurrent_ = numConcurrent;
  }

  add(fn: () => Promise<T>): void {
    this.pendingTasks_.push(fn);
  }

  async onIdle(): Promise<T[]> {
    const results: T[] = [];
    while (this.pendingTasks_.length > 0) {
      if (this.runningTasks_.length >= this.numConcurrent_) {
        await Promise.race(this.runningTasks_);
        continue;
      }
      const task = this.pendingTasks_.shift();
      if (task === undefined) continue;
      const promise = task();
      this.runningTasks_.push(promise);
      promise.then((result) => {
        results.push(result);
        const index = this.runningTasks_.indexOf(promise);
        this.runningTasks_.splice(index, 1);
      });
    }
    await Promise.all(this.runningTasks_);
    return results;
  }
}
