import { LayerManager } from "./layer_manager";
import { Camera } from "../objects/cameras/camera";
import { Color, ColorLike } from "./color";
import { Layer } from "./layer";
import { Box2 } from "../math/box2";

export abstract class Renderer {
  private readonly canvas_: HTMLCanvasElement | null;
  private width_ = 0;
  private height_ = 0;
  private backgroundColor_: Color = new Color(0, 0, 0, 0);
  private activeCamera_: Camera | null = null;

  protected abstract resize(width: number, height: number): void;
  protected abstract renderObject(layer: Layer, objectIndex: number): void;
  protected abstract clear(): void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas_ = canvas;
    this.updateRendererSize();
  }

  protected set activeCamera(camera: Camera) {
    if (this.activeCamera_ !== camera) {
      this.activeCamera_ = camera;
      this.updateActiveCamera();
    }
  }

  // TODO: make this just take a Viewport instance once implemented
  public abstract render(
    layerManager: LayerManager,
    camera: Camera,
    viewportBox?: Box2
  ): void;

  public updateSize(): void {
    this.updateRendererSize();
    this.resize(this.width_, this.height_);
  }

  private updateRendererSize() {
    this.width_ = this.canvas.clientWidth * window.devicePixelRatio;
    this.height_ = this.canvas.clientHeight * window.devicePixelRatio;

    if (this.canvas.width !== this.width_) this.canvas.width = this.width_;
    if (this.canvas.height !== this.height_) this.canvas.height = this.height_;

    this.updateActiveCamera();
  }

  private updateActiveCamera() {
    const canvasAspectRatio = this.width_ / this.height_;
    if (this.activeCamera_) {
      this.activeCamera_.setAspectRatio(canvasAspectRatio);
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

  public get backgroundColor(): Color {
    return this.backgroundColor_;
  }

  public set backgroundColor(color: ColorLike) {
    this.backgroundColor_ = Color.from(color);
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
