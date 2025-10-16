import { RenderableObject } from "../core/renderable_object";
import { Logger } from "./logger";

export class RenderablePool<T extends RenderableObject> {
  private readonly bins_ = new Map<string, T[]>();

  acquire(key: string) {
    const bin = this.bins_.get(key);
    const item = bin?.pop();
    if (item) {
      Logger.debug("RenderablePool", "Renderable object acquired");
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
    Logger.debug("RenderablePool", "Renderable object released");
  }

  clearAll(disposer?: (t: T) => void) {
    if (disposer) for (const bin of this.bins_.values()) bin.forEach(disposer);
    this.bins_.clear();
  }
}
