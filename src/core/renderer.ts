import { LayerManager } from "core/layer_manager";
import { RenderableObject } from "./renderable_object";

export abstract class Renderer {
  private readonly canvas_: HTMLCanvasElement | null;
  private lastTimestamp_ = 0;
  private width_ = 0;
  private height_ = 0;
  private layerManager_: LayerManager;

  protected abstract resize(width: number, height: number): void;
  protected abstract renderObject(object: RenderableObject): void;
  protected abstract clear(): void;

  constructor(selector: string, layerManager: LayerManager) {
    this.layerManager_ = layerManager;
    this.canvas_ = document.querySelector<HTMLCanvasElement>(selector);
    if (!this.canvas_) {
      throw new Error(`Canvas element not found for selector: "${selector}"`);
    }
    this.updateRendererSize();
    window.addEventListener("resize", () => {
      this.updateRendererSize();
      this.resize(this.width_, this.height_);
    });
  }

  public render() {
    const nextFrame = (timestamp: number) => {
      const dt = (timestamp - this.lastTimestamp_) / 1000;
      this.lastTimestamp_ = timestamp;
      this.renderFrame(dt);
      requestAnimationFrame(nextFrame);
    };
    requestAnimationFrame(nextFrame);
  }

  private renderFrame(_: number) {
    this.clear();
    this.layerManager_.layers.forEach((layer) => {
      layer.objects.forEach((obj) => this.renderObject(obj));
    });
  }

  private updateRendererSize() {
    this.width_ = this.canvas.clientWidth * window.devicePixelRatio;
    this.height_ = this.canvas.clientHeight * window.devicePixelRatio;
  }

  protected get canvas() {
    return this.canvas_!;
  }

  protected get width() {
    return this.width_;
  }

  protected get height() {
    return this.height_;
  }

  protected get layers() {
    return this.layerManager_;
  }
}
