export class TaskExecutor<T> {
  private readonly maxConcurrentTasks_: number;
  private readonly runningTasks_: Array<Promise<T>> = [];
  private readonly pendingTasks_: Array<() => Promise<T>> = [];

  constructor(maxConcurrentTasks: number = 4) {
    if (maxConcurrentTasks <= 0) {
      throw Error(
        `maxConcurrentTasks (${maxConcurrentTasks}) must be positive`
      );
    }
    this.maxConcurrentTasks_ = maxConcurrentTasks;
  }

  async submit(task: () => Promise<T>): Promise<T> {
    this.pendingTasks_.push(task);
    while (this.pendingTasks_[0] !== task) {
      await this.waitUntilReady();
    }
    this.pendingTasks_.shift();
    const promise = task();
    this.runningTasks_.push(promise);
    const result = await promise;
    const index = this.runningTasks_.indexOf(promise);
    this.runningTasks_.splice(index, 1);
    return result;
  }

  private async waitUntilReady(): Promise<void> {
    while (this.runningTasks_.length >= this.maxConcurrentTasks_) {
      await Promise.race(this.runningTasks_);
    }
  }
}

export class TaskQueue<T> {
  private tasks_: Array<() => Promise<T>> = [];
  private executor_: TaskExecutor<T>;

  constructor(executor: TaskExecutor<T>) {
    this.executor_ = executor;
  }

  add(task: () => Promise<T>): void {
    this.tasks_.push(task);
  }

  async onIdle(): Promise<T[]> {
    return await Promise.all(
      this.tasks_.map((task) => this.executor_.submit(task))
    );
  }
}
