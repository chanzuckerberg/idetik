import { RenderableObject } from "./renderable_object";
import { clamp } from "utilities/clamp";

export type LayerState = "initialized" | "loading" | "ready";
export type BlendingMode = "normal" | "additive" | "subtractive" | "multiply";

type StateChangeCallback = (
  newState: LayerState,
  prevState?: LayerState
) => void;

export interface LayerOptions {
  isTransparent?: boolean;
  opacity?: number;
  blendingMode?: BlendingMode;
  zIndex?: number;
}

export abstract class Layer {
  private objects_: RenderableObject[] = [];
  private state_: LayerState = "initialized";
  private readonly callbacks_: StateChangeCallback[] = [];

  public zIndex: number = 0;
  public isTransparent: boolean;
  public opacity: number;
  public blendingMode: BlendingMode;

  constructor({
    isTransparent = false,
    opacity = 1.0,
    blendingMode = "normal",
    zIndex = 0,
  }: LayerOptions = {}) {
    if (opacity < 0 || opacity > 1) {
      console.warn(
        `Layer opacity out of bounds: ${opacity} — clamping to [0.0, 1.0]`
      );
    }
    this.isTransparent = isTransparent;
    this.opacity = clamp(opacity, 0.0, 1.0);
    this.blendingMode = blendingMode;
    this.zIndex = zIndex;
  }

  public setZIndex(z: number): void {
    this.zIndex = z;
  }

  public setBlendingMode(mode: BlendingMode): void {
    this.blendingMode = mode;
  }

  public setOpacity(opacity: number): void {
    this.opacity = clamp(opacity, 0.0, 1.0);
  }

  public setIsTransparent(isTransparent: boolean): void {
    this.isTransparent = isTransparent;
  }

  public abstract update(): void;

  public get objects() {
    return this.objects_;
  }

  public get state() {
    return this.state_;
  }

  public addStateChangeCallback(callback: StateChangeCallback) {
    this.callbacks_.push(callback);
  }

  public removeStateChangeCallback(callback: StateChangeCallback) {
    const index = this.callbacks_.indexOf(callback);
    if (index === undefined) {
      throw new Error(`Callback to remove could not be found: ${callback}`);
    }
    this.callbacks_.splice(index, 1);
  }

  protected setState(newState: LayerState) {
    const prevState = this.state_;
    this.state_ = newState;
    // console.debug(`${this.constructor.name} state change: ${newState}`);
    this.callbacks_.forEach((callback) => callback(newState, prevState));
  }

  protected addObject(object: RenderableObject) {
    this.objects_.push(object);
  }

  protected clearObjects() {
    this.objects_ = [];
  }
}
