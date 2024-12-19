class Task<T> {
  private readonly task_;
  private readonly id_;
  private cancelled_ = false;
  private promise_: Promise<T> | null = null;

  constructor(task: () => Promise<T>) {
    this.task_ = task;
    this.id_ = window.crypto.randomUUID();
  }

  async run(): Promise<T> {
    this.promise_ = this.task_();
    return this.promise_;
  }

  get promise() {
    return this.promise_;
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
  private readonly runningTasks_: Array<Task<T>> = [];
  private readonly pendingTasks_: Array<Task<T>> = [];

  constructor(maxConcurrentTasks: number) {
    if (maxConcurrentTasks <= 0) {
      throw Error(
        `maxConcurrentTasks (${maxConcurrentTasks}) must be positive`
      );
    }
    this.maxConcurrentTasks_ = maxConcurrentTasks;
  }

  async submit(task: () => Promise<T>): Promise<T> {
    const t = new Task(task);
    this.pendingTasks_.push(t);
    while (!t.cancelled && !this.shouldRunNext(t)) {
      const running = this.runningTasks_
        .map((task) => task.promise)
        .filter((promise) => promise !== null);
      await Promise.race(running);
    }
    if (t.cancelled) {
      remove(this.pendingTasks_, t);
      throw "cancelled";
    }
    this.pendingTasks_.shift();
    this.runningTasks_.push(t);
    // TODO: understand why vitest reports an unhandled error unless
    // we explicitly use the catch callback to rethrow.
    const promise = t
      .run()
      .catch((error) => {
        throw error;
      })
      .finally(() => {
        remove(this.runningTasks_, t);
      });
    return await promise;
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

  get numRunning() {
    return this.runningTasks_.length;
  }
}

function remove<T>(a: Array<T>, o: T) {
  const index = a.indexOf(o);
  a.splice(index, 1);
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
