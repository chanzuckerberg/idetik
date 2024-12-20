export class CancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CancellationError";
    // Manually adjust the prototype to handle sub-classing Error
    // https://github.com/microsoft/TypeScript/wiki/FAQ#why-doesnt-extending-built-ins-like-error-array-and-map-work
    Object.setPrototypeOf(this, CancellationError.prototype);
  }
}

class Cancelable<T> {
  task_: () => Promise<T>;
  resolve_: (value: T | PromiseLike<T>) => void;
  reject_: (reason?: unknown) => void;
  finally_: () => void;
  canceled_: boolean = false;

  constructor(
    task: () => Promise<T>,
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: unknown) => void,
    finally_: () => void
  ) {
    this.task_ = task;
    this.resolve_ = resolve;
    this.reject_ = reject;
    this.finally_ = finally_;
  }

  cancel() {
    this.canceled_ = true;
  }

  async run() {
    if (this.canceled_) {
      this.reject_(new CancellationError("Task canceled"));
    }
    try {
      const result = await this.task_();
      this.resolve_(result);
    } catch (error) {
      this.reject_(error);
    } finally {
      this.finally_();
    }
  }
}

// Executes a limited number of tasks concurrently.
export class TaskExecutor<T> {
  private readonly maxConcurrentTasks_: number;
  private readonly pendingTasks_: Array<Cancelable<T>> = [];
  private numRunning_ = 0;

  constructor(maxConcurrentTasks: number) {
    if (maxConcurrentTasks <= 0) {
      throw Error(
        `maxConcurrentTasks (${maxConcurrentTasks}) must be positive`
      );
    }
    this.maxConcurrentTasks_ = maxConcurrentTasks;
  }

  async submit(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const pending = new Cancelable(task, resolve, reject, () => {
        this.numRunning_--;
        this.maybeRunNextTask();
      });
      this.pendingTasks_.push(pending);
      this.maybeRunNextTask();
    });
  }

  private maybeRunNextTask(): void {
    if (this.numRunning_ >= this.maxConcurrentTasks_) return;
    const pending = this.pendingTasks_.shift();
    if (pending === undefined) return;
    this.numRunning_++;
    pending.run();
  }

  cancelPending() {
    console.debug(`Cancelling ${this.pendingTasks_.length} tasks.`);
    for (const task of this.pendingTasks_) {
      task.cancel();
    }
  }

  get numRunning() {
    return this.numRunning_;
  }

  get numPending() {
    return this.pendingTasks_.length;
  }
}
