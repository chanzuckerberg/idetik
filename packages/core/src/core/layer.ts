import { RenderableObject } from "./renderable_object";
import { clamp01 } from "./utils";

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
}

export abstract class Layer {
  private objects_: RenderableObject[] = [];
  private state_: LayerState = "initialized";
  private callbacks_: StateChangeCallback[] = [];

  public readonly isTransparent: boolean;
  /**
   * For layer opacity, value is clamped to the range [0.0, 1.0].
   */
  public readonly opacity: number;
  public readonly blendingMode: BlendingMode;

  /* eslint-disable @typescript-eslint/no-unused-vars -- these fields are scaffolded for upcoming blending support */
  constructor({
    isTransparent = false,
    opacity = 1.0,
    blendingMode = "normal",
  }: LayerOptions = {}) {
    if (opacity < 0 || opacity > 1) {
      console.warn(
        `Layer opacity out of bounds: ${opacity} — clamping to [0.0, 1.0]`
      );
    }
    this.isTransparent = isTransparent;
    this.opacity = clamp01(opacity);
    this.blendingMode = blendingMode;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

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
    console.debug(`${this.constructor.name} state change: ${newState}`);
    this.callbacks_.forEach((callback) => callback(newState, prevState));
  }

  protected addObject(object: RenderableObject) {
    this.objects_.push(object);
  }

  protected clearObjects() {
    this.objects_ = [];
  }
}
