import { IdetikContext } from "../idetik";
import { RenderableObject } from "./renderable_object";
import { clamp } from "../utilities/clamp";
import { Logger } from "../utilities/logger";
import { EventContext } from "./event_dispatcher";
import { Viewport } from "./viewport";

export type LayerState = "initialized" | "loading" | "ready";
export type blendMode = "normal" | "additive" | "subtractive" | "multiply";

type StateChangeCallback = (
  newState: LayerState,
  prevState?: LayerState
) => void;

export interface LayerOptions {
  transparent?: boolean;
  opacity?: number;
  blendMode?: blendMode;
}

export type RenderContext = {
  viewport: Viewport;
};

export abstract class Layer {
  public abstract readonly type: string;

  private objects_: RenderableObject[] = [];
  private state_: LayerState = "initialized";
  private readonly callbacks_: StateChangeCallback[] = [];

  public transparent: boolean;
  private opacity_: number;
  public blendMode: blendMode;

  constructor({
    transparent = false,
    opacity = 1.0,
    blendMode = "normal",
  }: LayerOptions = {}) {
    if (opacity < 0 || opacity > 1) {
      Logger.warn(
        "Layer",
        `Layer opacity out of bounds: ${opacity} — clamping to [0.0, 1.0]`
      );
    }
    this.transparent = transparent;
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

  public abstract update(context?: RenderContext): void;

  public onEvent(_: EventContext): void {}

  // TODO: Consider making this an abstract method once chunk manager
  // integration is finalized. Most layers will likely need access to the chunk
  // manager, but for now, we allow optional overrides to avoid requiring
  // placeholder implementations.
  public async onAttached(_context: IdetikContext) {}

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
}
