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
  private readonly element_: HTMLElement;
  private isConnected_ = false;

  constructor(element: HTMLElement) {
    this.element_ = element;
  }

  public addEventListener(listener: Listener) {
    this.listeners_.push(listener);
  }

  public connect() {
    if (this.isConnected_) {
      Logger.debug(
        "EventDispatcher",
        "Attempted to connect already connected event dispatcher",
        `element id: ${this.element_.id}`
      );
      return;
    }
    this.isConnected_ = true;
    eventTypes.forEach((type) => {
      this.element_.addEventListener(type, this.handleEvent, {
        passive: false,
      });
    });
  }

  public disconnect() {
    if (!this.isConnected_) {
      Logger.debug(
        "EventDispatcher",
        "Attempted to disconnect already disconnected event dispatcher",
        `element id: ${this.element_.id}`
      );
      return;
    }
    this.isConnected_ = false;
    eventTypes.forEach((type) => {
      this.element_.removeEventListener(type, this.handleEvent);
    });
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
