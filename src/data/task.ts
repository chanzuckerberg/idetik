class Task<T> {
  private readonly task_;
  private readonly id_;
  private cancelled_ = false;

  constructor(task: () => Promise<T>) {
    this.task_ = task;
    this.id_ = window.crypto.randomUUID();
  }

  async run(): Promise<T> {
    return this.task_();
  }

  get id() {
    return this.id_;
  }

  get cancelled() {
    return this.cancelled_;
  }

  cancel() {
    this.cancelled_ = true;
  }
}

export class TaskExecutor<T> {
  private readonly maxConcurrentTasks_: number;
  private readonly runningTasks_: Array<Promise<T>> = [];
  private readonly pendingTasks_: Array<Task<T>> = [];

  constructor(maxConcurrentTasks: number) {
    if (maxConcurrentTasks <= 0) {
      throw Error(
        `maxConcurrentTasks (${maxConcurrentTasks}) must be positive`
      );
    }
    this.maxConcurrentTasks_ = maxConcurrentTasks;
  }

  async submit(task: () => Promise<T>): Promise<T | void> {
    const t = new Task(task);
    this.pendingTasks_.push(t);
    while (!t.cancelled && !this.shouldRunNext(t)) {
      await Promise.race(this.runningTasks_);
    }
    if (t.cancelled) {
      const index = this.pendingTasks_.indexOf(t);
      this.pendingTasks_.splice(index, 1);
      return;
    }
    const promise = t.run();
    this.runningTasks_.push(promise);
    this.pendingTasks_.shift();
    const result = await promise;
    const index = this.runningTasks_.indexOf(promise);
    this.runningTasks_.splice(index, 1);
    return result;
  }

  private shouldRunNext(task: Task<T>) {
    return (
      this.pendingTasks_[0] === task &&
      this.runningTasks_.length < this.maxConcurrentTasks_
    );
  }

  clear() {
    console.debug(`Cancelling ${this.pendingTasks_.length} tasks.`);
    this.pendingTasks_.forEach((task) => task.cancel());
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

  async onIdle(): Promise<Array<T | void>> {
    return await Promise.all(
      this.tasks_.map((task) => this.executor_.submit(task))
    );
  }
}
