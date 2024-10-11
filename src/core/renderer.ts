import { mat4 } from "gl-matrix";

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
  protected abstract renderObject(
    object: RenderableObject,
    modelView: mat4
  ): void;
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
          // TODO: cache the modelView matrix
          // https://github.com/chanzuckerberg/imaging-active-learning/issues/80
          const modelView = mat4.multiply(
            mat4.create(),
            obj.transform.matrix,
            layer.transform.matrix
          );
          mat4.multiply(
            modelView,
            modelView,
            this.activeCamera.transform.inverse
          );

          this.renderObject(obj, modelView);
        });
      }
    });
  }

  private updateRendererSize() {
    this.width_ = this.canvas.clientWidth * window.devicePixelRatio;
    this.height_ = this.canvas.clientHeight * window.devicePixelRatio;

    if (this.canvas.width !== this.width_) this.canvas.width = this.width_;
    if (this.canvas.height !== this.height_) this.canvas.height = this.height_;

    if (this.activeCamera_) {
      if (this.activeCamera_ instanceof PerspectiveCamera) {
        this.activeCamera_.setAspectRatio(this.width_ / this.height_);
      }
      if (this.activeCamera_ instanceof OrthographicCamera) {
        this.activeCamera_.setFrame(
          -this.width / 2,
          this.width / 2,
          -this.height / 2,
          this.height / 2
        );
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
