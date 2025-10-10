import { Logger } from "./logger";

export class Pool<T> {
  private readonly bins_ = new Map<string, T[]>();

  acquire(key: string) {
    const bin = this.bins_.get(key);
    const item = bin?.pop();
    if (item) {
      Logger.debug("Pool", "Object acquired");
    }
    return item;
  }

  release(key: string, item: T) {
    let bin = this.bins_.get(key);
    if (!bin) {
      bin = [];
      this.bins_.set(key, bin);
    }
    bin.push(item);
    Logger.debug("Pool", "Object released");
  }

  clearAll(disposer?: (t: T) => void) {
    if (disposer) for (const bin of this.bins_.values()) bin.forEach(disposer);
    this.bins_.clear();
  }
}
