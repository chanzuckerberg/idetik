import { vec3 } from "gl-matrix";
import { Logger } from "../utilities/logger";
import { Viewport } from "./viewport";

const eventTypes = [
  "pointerdown",
  "pointermove",
  "pointerup",
  "pointercancel",
  "wheel",
] as const;

type EventType = (typeof eventTypes)[number];
function isEventType(type: string): type is EventType {
  return (eventTypes as readonly string[]).includes(type);
}

export class EventContext {
  private propagationStopped_: boolean = false;
  public readonly type: EventType;
  public readonly event?: Event;
  public worldPos?: vec3;
  public clipPos?: vec3;

  constructor(type: EventType, event?: Event) {
    this.type = type;
    this.event = event;
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
    // Add listeners to canvas for backward compatibility
    eventTypes.forEach((type) => {
      canvas.addEventListener(type, this.handleEvent, { passive: false });
    });
  }

  public addEventListener(listener: Listener) {
    this.listeners_.push(listener);
  }

  public setViewports(viewports: Viewport[]) {
    // Remove existing viewport event handlers
    for (const [viewport, handler] of this.viewportEventHandlers_) {
      eventTypes.forEach((type) => {
        viewport.element.removeEventListener(type, handler);
      });
    }
    this.viewportEventHandlers_.clear();

    // Set up direct event listeners on each viewport element
    for (const viewport of viewports) {
      const handler = this.createViewportEventHandler(viewport);
      this.viewportEventHandlers_.set(viewport, handler);

      eventTypes.forEach((type) => {
        viewport.element.addEventListener(type, handler, { passive: false });
      });
    }
  }

  private createViewportEventHandler(viewport: Viewport): (e: Event) => void {
    return (e: Event) => {
      if (!isEventType(e.type)) {
        Logger.error("EventDispatcher", `Unsupported event type ${e.type}`);
        return;
      }

      const event = new EventContext(e.type, e);

      // Set up coordinate transformations based on the specific viewport
      if (e instanceof PointerEvent || e instanceof WheelEvent) {
        const { clientX, clientY } = e;
        const { clipX, clipY } = viewport.clientToViewportClip(
          clientX,
          clientY
        );
        event.clipPos = vec3.fromValues(clipX, clipY, 0);
        event.worldPos = viewport.camera.clipToWorld(event.clipPos);
      }

      for (const layer of viewport.layerManager.layers) {
        layer.onEvent(event);
        if (event.propagationStopped) return;
      }

      viewport.cameraControls?.onEvent(event);
    };
  }

  private readonly handleEvent = (e: Event) => {
    if (!isEventType(e.type)) {
      Logger.error("EventDispatcher", `Unsupported event type ${e.type}`);
      return;
    }

    const event = new EventContext(e.type, e);

    // Handle global listeners (for backward compatibility with single viewport)
    for (const listener of this.listeners_) {
      listener(event);
      if (event.propagationStopped) break;
    }
  };
}
