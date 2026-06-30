import { IdetikContext } from "../idetik";
import { RenderableObject } from "./renderable_object";
import { clamp } from "../utilities/clamp";
import { Logger } from "../utilities/logger";
import { EventContext } from "./event_dispatcher";
import { Viewport } from "./viewport";

/** @group Layers */
export type LayerState = "initialized" | "loading" | "ready";
export type BlendMode =
  | "none"
  | "normal"
  | "additive"
  | "subtractive"
  | "multiply"
  | "premultiplied";

type StateChangeCallback = (
  newState: LayerState,
  prevState?: LayerState
) => void;

export interface LayerOptions {
  opacity?: number;
  blendMode?: BlendMode;
}

/**
 * Abstract base class for everything that can be added to a viewport.
 *
 * A `Layer` owns a set of renderable objects and contributes them to the scene
 * each frame. Subclasses (e.g. {@link ImageLayer}, {@link VolumeLayer},
 * {@link LabelLayer}) implement {@link Layer.update} to build or refresh those
 * objects for the current view, and may override the `attach`/`detach` hooks to
 * acquire and release resources when the layer joins or leaves a viewport.
 *
 * Layers carry shared presentation state — {@link Layer.opacity} and blend mode —
 * and expose a lifecycle {@link LayerState} (`initialized` → `loading` → `ready`)
 * that observers can subscribe to. A layer instance may be attached to only one
 * viewport at a time.
 *
 * @group Layers
 */
export abstract class Layer {
  public abstract readonly type: string;

  private objects_: RenderableObject[] = [];
  private state_: LayerState = "initialized";
  private attached_ = false;
  private readonly callbacks_: StateChangeCallback[] = [];

  private opacity_: number;
  public blendMode: BlendMode;

  constructor({ opacity = 1.0, blendMode = "none" }: LayerOptions = {}) {
    this.opacity_ = clamp(opacity, 0.0, 1.0);
    this.blendMode = blendMode;
  }

  public get opacity() {
    return this.opacity_;
  }

  public set opacity(value: number) {
    if (value < 0 || value > 1) {
      Logger.warn(
        "Layer",
        `Opacity out of bounds: ${value} — clamping to [0.0, 1.0]`
      );
    }
    this.opacity_ = clamp(value, 0.0, 1.0);
  }

  public abstract update(viewport?: Viewport): void;

  public onEvent(_: EventContext): void {}

  public onAttached(context: IdetikContext): void {
    if (this.attached_) {
      throw new Error(
        `${this.type} cannot be attached to multiple viewports simultaneously.`
      );
    }
    this.attach(context);
    this.attached_ = true;
  }

  public onDetached(context: IdetikContext): void {
    if (!this.attached_) return;
    this.detach(context);
    this.attached_ = false;
  }

  protected attach(_context: IdetikContext): void {}

  protected detach(_context: IdetikContext): void {}

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

  public hasMultipleLODs(): boolean {
    return false;
  }

  protected setState(newState: LayerState) {
    const prevState = this.state_;
    this.state_ = newState;
    this.callbacks_.forEach((callback) => callback(newState, prevState));
  }

  protected addObject(object: RenderableObject) {
    this.objects_.push(object);
  }

  protected removeObject(object: RenderableObject) {
    const index = this.objects_.indexOf(object);
    if (index !== -1) {
      this.objects_.splice(index, 1);
    }
  }

  protected clearObjects() {
    this.objects_ = [];
  }

  /**
   * Get uniforms for shader program. Override in derived classes that need custom uniforms.
   * @returns Object containing uniform name-value pairs
   */
  public getUniforms(): Record<string, unknown> {
    return {}; // Default implementation returns no uniforms
  }
}
