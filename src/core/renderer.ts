import { Camera } from "../objects/cameras/camera";
import { Layer } from "./layer";
import { RenderableObject } from "./renderable_object";
import { Viewport } from "./viewport";
import { Texture } from "../objects/textures/texture";

export abstract class Renderer {
  private readonly canvas_: HTMLCanvasElement | null;
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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas_ = canvas;
    this.updateRendererSize();
  }

  public beginFrame(): void {}

  /** Updates the viewport's layers (visible chunks, LOD), then draws it. */
  public render(viewport: Viewport): void {
    this.updateLayers(viewport);
    this.draw(viewport);
  }

  /**
   * Updates each layer for the viewport without drawing: works out what is
   * visible and requests the chunks it needs.
   */
  public updateLayers(viewport: Viewport): void {
    for (const layer of viewport.layers) {
      layer.update(viewport);
    }
  }

  /** Draws the viewport's layers as last updated. */
  public abstract draw(viewport: Viewport): void;

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

  public get renderedObjects() {
    return this.renderedObjects_;
  }

  public abstract get gpuTextureBytes(): number;

  public abstract get gpuTextureCount(): number;

  public abstract uploadTexture(texture: Texture): void;

  public abstract disposeTexture(texture: Texture): void;
}
