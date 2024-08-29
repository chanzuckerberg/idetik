import { LayerManager } from "./layer_manager";
import { Mesh } from "objects/renderable/mesh";
import { Camera } from "objects/cameras/camera";

export abstract class Renderer {
  private readonly canvas_: HTMLCanvasElement | null;
  private width_ = 0;
  private height_ = 0;
  private activeCamera_: Camera | null = null;

  protected abstract resize(width: number, height: number): void;
  protected abstract renderMesh(mesh: Mesh): void;
  protected abstract clear(): void;

  constructor(selector: string) {
    this.canvas_ = document.querySelector<HTMLCanvasElement>(selector);
    if (!this.canvas_) {
      throw new Error(`Canvas element not found for selector "${selector}"`);
    }
    this.updateRendererSize();
    window.addEventListener("resize", () => {
      this.updateRendererSize();
      this.resize(this.width_, this.height_);
    });
  }

  public render(layerManager: LayerManager, camera: Camera) {
    this.clear();
    this.activeCamera_ = camera;
    layerManager.layers.forEach((layer) => {
      layer.objects.forEach((obj) => {
        // Before sending the object to the renderer backend, we must verify
        // its visibility by checking its render state and location relative
        // to the view frustum.
        switch (obj.type) {
          case "Mesh":
            this.renderMesh(obj as Mesh);
            break;
          default:
            throw new Error(`Unknown renderable object "${obj.type}"`);
        }
      });
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

  protected get activeCamera() {
    if (this.activeCamera_ === null) {
      throw new Error(
        "Attempted to access the active camera before it was set."
      );
    }
    return this.activeCamera_;
  }
}
