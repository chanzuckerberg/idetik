import { Camera } from "../objects/cameras/camera";
import { Layer } from "./layer";
import { RenderableObject } from "./renderable_object";
import { Viewport } from "./viewport";
import { Texture } from "../objects/textures/texture";

export abstract class Renderer {
  private readonly canvas_: HTMLCanvasElement | null;
  private readonly pixelRatio_?: number;
  private width_ = 0;
  private height_ = 0;

  protected renderedObjects_ = 0;
  protected abstract resize(width: number, height: number): void;
  protected abstract renderObject(
    layer: Layer,
    object: RenderableObject,
    camera: Camera
  ): void;
  protected abstract clear(): void;

  constructor(canvas: HTMLCanvasElement, pixelRatio?: number) {
    if (
      pixelRatio !== undefined &&
      !(Number.isFinite(pixelRatio) && pixelRatio > 0)
    ) {
      throw new Error(
        `Failed to initialize renderer: pixel ratio must be a positive number, got ${pixelRatio}`
      );
    }

    this.canvas_ = canvas;
    this.pixelRatio_ = pixelRatio;
    this.updateRendererSize();
  }

  public beginFrame(): void {}

  public abstract render(viewport: Viewport): void;

  public updateSize(): void {
    this.updateRendererSize();
    this.resize(this.width_, this.height_);
  }

  private updateRendererSize() {
    this.width_ = this.canvas.clientWidth * this.pixelRatio;
    this.height_ = this.canvas.clientHeight * this.pixelRatio;

    if (this.canvas.width !== this.width_) this.canvas.width = this.width_;
    if (this.canvas.height !== this.height_) this.canvas.height = this.height_;
  }

  protected get canvas() {
    return this.canvas_!;
  }

  public get pixelRatio(): number {
    return this.pixelRatio_ ?? (window.devicePixelRatio || 1);
  }

  public get width() {
    return this.width_;
  }

  public get height() {
    return this.height_;
  }

  public get renderedObjects() {
    return this.renderedObjects_;
  }

  public abstract get gpuTextureBytes(): number;

  public abstract get gpuTextureCount(): number;

  public abstract uploadTexture(texture: Texture): void;

  public abstract disposeTexture(texture: Texture): void;
}
