import { vec2, vec3 } from "gl-matrix";
import { Logger } from "../utilities/logger";
import { Viewport } from "./viewport";

const eventTypes = [
  "pointerdown",
  "pointermove",
  "pointerup",
  "pointercancel",
  "wheel",
  "mouseenter",
  "mouseleave",
] as const;

type EventType = (typeof eventTypes)[number];
function isEventType(type: string): type is EventType {
  return (eventTypes as readonly string[]).includes(type);
}

export class EventContext {
  private propagationStopped_: boolean = false;
  public readonly type: EventType;
  public readonly event: Event;
  public readonly clientPos: vec2;
  public readonly worldPos?: vec3;
  public readonly clipPos?: vec3;
  public readonly sourceViewport?: Viewport;

  constructor(
    type: EventType,
    event: Event,
    clientPos: vec2,
    worldPos?: vec3,
    clipPos?: vec3,
    sourceViewport?: Viewport
  ) {
    this.type = type;
    this.event = event;
    this.clientPos = clientPos;
    this.worldPos = worldPos;
    this.clipPos = clipPos;
    this.sourceViewport = sourceViewport;
  }

  get propagationStopped() {
    return this.propagationStopped_;
  }

  stopPropagation() {
    this.propagationStopped_ = true;
  }
}

type Listener = (event: EventContext) => void;

export class EventDispatcher {
  private readonly listeners_: Listener[] = [];
  private readonly viewportEventHandlers_: Map<Viewport, (e: Event) => void> =
    new Map();

  constructor(canvas: HTMLCanvasElement) {
    eventTypes.forEach((type) => {
      canvas.addEventListener(type, this.handleEvent, { passive: false });
    });
  }

  public addEventListener(listener: Listener) {
    this.listeners_.push(listener);
  }

  public addViewport(viewport: Viewport) {
    if (this.viewportEventHandlers_.has(viewport)) {
      Logger.warn(
        "EventDispatcher",
        `Viewport ${viewport.id} already registered`
      );
      return;
    }

    const handler = this.createViewportEventHandler(viewport);
    this.viewportEventHandlers_.set(viewport, handler);

    eventTypes.forEach((type) => {
      viewport.element.addEventListener(type, handler, { passive: false });
    });
  }

  public removeViewport(viewport: Viewport) {
    const handler = this.viewportEventHandlers_.get(viewport);
    if (!handler) {
      Logger.warn(
        "EventDispatcher",
        `Viewport ${viewport.id} not found for removal`
      );
      return;
    }

    eventTypes.forEach((type) => {
      viewport.element.removeEventListener(type, handler);
    });
    this.viewportEventHandlers_.delete(viewport);
  }

  public setViewports(viewports: Viewport[]) {
    for (const viewport of this.viewportEventHandlers_.keys()) {
      this.removeViewport(viewport);
    }

    for (const viewport of viewports) {
      this.addViewport(viewport);
    }
  }

  private createViewportEventHandler(viewport: Viewport): (e: Event) => void {
    return (e: Event) => {
      if (!isEventType(e.type)) {
        Logger.error("EventDispatcher", `Unsupported event type ${e.type}`);
        return;
      }

      const clientPos = this.extractClientPos(e);

      const { worldPos, clipPos } = this.getWorldPosition(e, viewport);
      const event = new EventContext(
        e.type,
        e,
        clientPos,
        worldPos,
        clipPos,
        viewport
      );

      // pass viewport events to their own layers first
      for (const layer of viewport.layerManager.layers) {
        layer.onEvent(event);
        if (event.propagationStopped) return;
      }

      viewport.cameraControls?.onEvent(event);
      if (event.propagationStopped) return;

      for (const listener of this.listeners_) {
        listener(event);
        if (event.propagationStopped) return;
      }
    };
  }

  private extractClientPos(event: Event): vec2 {
    if (this.hasClientCoordinates(event)) {
      return vec2.fromValues(event.clientX, event.clientY);
    }
    return vec2.fromValues(0, 0);
  }

  private getWorldPosition(
    event: Event,
    viewport: Viewport
  ): { worldPos?: vec3; clipPos?: vec3 } {
    if (this.hasClientCoordinates(event)) {
      const clipPos = viewport.clientToClip([event.clientX, event.clientY], 0);
      const worldPos = viewport.camera.clipToWorld(clipPos);
      return { worldPos, clipPos };
    } else {
      return {};
    }
  }

  private hasClientCoordinates(
    event: Event
  ): event is Event & { clientX: number; clientY: number } {
    return "clientX" in event && "clientY" in event;
  }

  private readonly handleEvent = (e: Event) => {
    if (!isEventType(e.type)) {
      Logger.error("EventDispatcher", `Unsupported event type ${e.type}`);
      return;
    }

    const clientPos = this.extractClientPos(e);

    // base canvas event - no viewport context
    const event = new EventContext(e.type, e, clientPos);

    for (const listener of this.listeners_) {
      listener(event);
      if (event.propagationStopped) return;
    }
  };
}
