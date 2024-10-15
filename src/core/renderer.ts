import { LayerManager } from "./layer_manager";
import { Camera } from "objects/cameras/camera";
import { RenderableObject } from "core/renderable_object";
import { PerspectiveCamera } from "objects/cameras/perspective_camera";
import { OrthographicCamera } from "@/objects/cameras/orthographic_camera";

export abstract class Renderer {
  private readonly canvas_: HTMLCanvasElement | null;
  private width_ = 0;
  private height_ = 0;
  private activeCamera_: Camera | null = null;

  protected abstract resize(width: number, height: number): void;
  protected abstract renderObject(object: RenderableObject): void;
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
      layer.update();
      if (layer.state === "ready") {
        layer.objects.forEach((obj) => {
          this.renderObject(obj);
        });
      }
    });
  }

  private updateRendererSize() {
    console.debug("Renderer::updateRendererSize", this.canvas.width, this.canvas.height, this.canvas.clientWidth, this.canvas.clientHeight, window.devicePixelRatio);
    this.width_ = this.canvas.clientWidth * window.devicePixelRatio;
    this.height_ = this.canvas.clientHeight * window.devicePixelRatio;

    const aspectRatio = this.width_ / this.height_;

    if (this.canvas.width !== this.width_) this.canvas.width = this.width_;
    if (this.canvas.height !== this.height_) this.canvas.height = this.height_;

    if (this.activeCamera_) {
      if (this.activeCamera_ instanceof PerspectiveCamera) {
        this.activeCamera_.setAspectRatio(aspectRatio);
      }
      if (this.activeCamera_ instanceof OrthographicCamera) {
        this.activeCamera_.setViewportAspectRatio(aspectRatio);
      }
      this.activeCamera_.update();
    }
  }

  protected get canvas() {
    return this.canvas_!;
  }

  public get width() {
    return this.width_;
  }

  public get height() {
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
