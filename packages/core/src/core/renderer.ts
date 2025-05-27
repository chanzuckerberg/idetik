import { vec2, vec3 } from "gl-matrix";
import { LayerManager } from "./layer_manager";
import { Camera } from "../objects/cameras/camera";
import { CameraControls, NullControls } from "../objects/cameras/controls";
import { Layer } from "./layer";

type Color = [number, number, number, number];

export abstract class Renderer {
  private readonly canvas_: HTMLCanvasElement | null;
  private width_ = 0;
  private height_ = 0;
  private backgroundColor_: Color = [0, 0, 0, 0];
  private activeCamera_: Camera | null = null;
  private controls_: CameraControls = new NullControls();
  private controlCallbacks_: [string, (event: Event) => void][] = [];

  protected abstract resize(width: number, height: number): void;
  protected abstract renderObject(layer: Layer, objectIndex: number): void;
  protected abstract clear(): void;

  protected beginTransparentPass(): void {}
  protected endTransparentPass(): void {}

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
    const { opaque, transparent } = layerManager.partitionLayers();

    for (const layer of opaque) {
      layer.update();
      if (layer.state === "ready") {
        for (let i = 0; i < layer.objects.length; i++) {
          this.renderObject(layer, i);
        }
      }
    }

    this.beginTransparentPass();
    for (const layer of transparent) {
      layer.update();
      if (layer.state !== "ready") continue;
      layer.objects.forEach((_, i) => this.renderObject(layer, i));
    }
    this.endTransparentPass();
  }

  public setControls(controls: CameraControls) {
    this.unbindControls();
    this.controls_ = controls;
    this.bindControls();
  }

  private unbindControls() {
    this.controlCallbacks_.forEach(([event, listener]) => {
      this.canvas.removeEventListener(event, listener);
    });
    this.controlCallbacks_ = [];
  }

  private bindControls() {
    const clientToClip = this.clientToClip.bind(this);
    this.controlCallbacks_ = this.controls_.callbacks(
      this.canvas,
      clientToClip
    );
    this.controlCallbacks_.forEach(([event, listener]) => {
      this.canvas.addEventListener(event, listener, { passive: false });
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

  public get backgroundColor() {
    return this.backgroundColor_;
  }

  public set backgroundColor(color: Color) {
    this.backgroundColor_ = color;
  }

  protected get activeCamera() {
    if (this.activeCamera_ === null) {
      throw new Error(
        "Attempted to access the active camera before it was set."
      );
    }
    return this.activeCamera_;
  }

  public clientToClip(position: vec2, depth: number = 0): vec3 {
    const [x, y] = position;
    const rect = this.canvas.getBoundingClientRect();
    return vec3.fromValues(
      (2 * (x - rect.x)) / this.canvas.clientWidth - 1,
      (2 * (y - rect.y)) / this.canvas.clientHeight - 1,
      depth
    );
  }
}
