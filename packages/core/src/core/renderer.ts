import { Camera } from "../objects/cameras/camera";
import { Color, ColorLike } from "./color";
import { Layer } from "./layer";
import { RenderableObject } from "./renderable_object";
import { Viewport } from "./viewport";

export abstract class Renderer {
  private readonly canvas_: HTMLCanvasElement | null;
  private width_ = 0;
  private height_ = 0;
  private backgroundColor_: Color = new Color(0, 0, 0, 1);

  protected renderedObjects_ = 0;
  protected abstract resize(width: number, height: number): void;
  protected abstract renderObject(
    layer: Layer,
    object: RenderableObject,
    camera: Camera
  ): void;
  protected abstract clear(): void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas_ = canvas;
    this.updateRendererSize();
  }

  public abstract render(viewport: Viewport): void;

  public updateSize(): void {
    this.updateRendererSize();
    this.resize(this.width_, this.height_);
  }

  private updateRendererSize() {
    this.width_ = this.canvas.clientWidth * window.devicePixelRatio;
    this.height_ = this.canvas.clientHeight * window.devicePixelRatio;

    if (this.canvas.width !== this.width_) this.canvas.width = this.width_;
    if (this.canvas.height !== this.height_) this.canvas.height = this.height_;
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

  public get renderedObjects() {
    return this.renderedObjects_;
  }

  public set backgroundColor(color: ColorLike) {
    this.backgroundColor_ = Color.from(color);
  }
}
