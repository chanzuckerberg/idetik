import { vec2 } from "gl-matrix";
import { LayerManager } from "./layer_manager";
import { Camera } from "objects/cameras/camera";
import { RenderableObject } from "core/renderable_object";
import { PerspectiveCamera } from "objects/cameras/perspective_camera";
import { OrthographicCamera } from "objects/cameras/orthographic_camera";

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
    if (this.activeCamera_ !== camera) {
      this.activeCamera_ = camera;
      this.updateActiveCamera();
    }
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
    this.width_ = this.canvas.clientWidth * window.devicePixelRatio;
    this.height_ = this.canvas.clientHeight * window.devicePixelRatio;

    if (this.canvas.width !== this.width_) this.canvas.width = this.width_;
    if (this.canvas.height !== this.height_) this.canvas.height = this.height_;

    this.updateActiveCamera();
  }

  private updateActiveCamera() {
    const aspectRatio = this.width_ / this.height_;
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

  public clientToClip(position: vec2): vec2 {
    const [x, y] = position;
    return vec2.fromValues(
      (2 * x) / this.canvas.clientWidth - 1,
      1 - (2 * y) / this.canvas.clientHeight
    );
  }
}
