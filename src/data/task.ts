export class TaskExecutor<T> {
  private readonly maxConcurrentTasks_: number;
  private runningTasks_: Array<Promise<T>> = [];

  constructor(maxConcurrentTasks: number = 16) {
    this.maxConcurrentTasks_ = maxConcurrentTasks;
  }

  async submit(task: Promise<T>): Promise<T> {
    while (this.runningTasks_.length >= this.maxConcurrentTasks_) {
      await Promise.race(this.runningTasks_);
    }
    this.runningTasks_.push(task);
    return task.then((result) => {
      const index = this.runningTasks_.indexOf(task);
      this.runningTasks_.splice(index, 1);
      return result;
    });
  }
}

export class TaskQueue<T> {
  private pendingTasks_: Array<() => Promise<T>> = [];
  private executor_: TaskExecutor<T>;

  constructor(executor: TaskExecutor<T>) {
    this.executor_ = executor;
  }

  add(fn: () => Promise<T>): void {
    this.pendingTasks_.push(fn);
  }

  async onIdle(): Promise<T[]> {
    return await Promise.all(
      this.pendingTasks_.map(async (pendingTask) => {
        return await this.executor_.submit(pendingTask());
      })
    );
  }
}
