import { vec3 } from "gl-matrix";
import { Logger } from "../utilities/logger";

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
  readonly type: EventType;
  readonly event: Event;
  private propagationStopped_: boolean = false;
  public clipPos?: vec3;
  public worldPos?: vec3;

  constructor(type: EventType, event: Event) {
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

  constructor(canvas: HTMLCanvasElement) {
    eventTypes.forEach((type) => {
      canvas.addEventListener(type, this.handleEvent, { passive: false });
    });
  }

  public addEventListener(listener: Listener) {
    this.listeners_.push(listener);
  }

  private readonly handleEvent = (e: Event) => {
    if (!isEventType(e.type)) {
      Logger.error("EventDispatcher", `Unsupported event type ${e.type}`);
      return;
    }

    const event = new EventContext(e.type, e);
    for (const listener of this.listeners_) {
      listener(event);
      if (event.propagationStopped) break;
    }
  };
}
