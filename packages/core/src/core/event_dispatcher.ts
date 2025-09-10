import { vec2, vec3 } from "gl-matrix";
import { Logger } from "../utilities/logger";

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

function hasClientCoordinates(
  event: Event
): event is Event & { clientX: number; clientY: number } {
  return "clientX" in event && "clientY" in event;
}

export class EventContext {
  private propagationStopped_: boolean = false;
  public readonly type: EventType;
  public readonly event: Event;
  public readonly clientPos: vec2;
  public readonly worldPos?: vec3;
  public readonly clipPos?: vec3;
  public readonly source?: EventProvider;

  constructor(
    type: EventType,
    event: Event,
    clientPos: vec2,
    worldPos?: vec3,
    clipPos?: vec3,
    source?: EventProvider
  ) {
    this.type = type;
    this.event = event;
    this.clientPos = clientPos;
    this.worldPos = worldPos;
    this.clipPos = clipPos;
    this.source = source;
  }

  get propagationStopped() {
    return this.propagationStopped_;
  }

  stopPropagation() {
    this.propagationStopped_ = true;
  }

  public static fromDOMEvent(domEvent: Event): EventContext | null {
    if (!isEventType(domEvent.type)) {
      return null;
    }
    const clientPos = hasClientCoordinates(domEvent)
      ? vec2.fromValues(domEvent.clientX, domEvent.clientY)
      : vec2.fromValues(0, 0);
    return new EventContext(domEvent.type, domEvent, clientPos);
  }
}

type Listener = (event: EventContext) => void;
type DOMEventListener = (e: Event) => void;

export interface EventProvider {
  readonly element: HTMLElement;
  processEvent(eventContext: EventContext): EventContext;
}

export class CanvasEventProvider implements EventProvider {
  public readonly element: HTMLCanvasElement;

  constructor(element: HTMLCanvasElement) {
    this.element = element;
  }

  processEvent(eventContext: EventContext): EventContext {
    return new EventContext(
      eventContext.type,
      eventContext.event,
      eventContext.clientPos,
      eventContext.worldPos,
      eventContext.clipPos,
      this
    );
  }
}

export class EventDispatcher {
  private readonly listeners_: Listener[] = [];
  private readonly domListeners_: Map<EventProvider, DOMEventListener> =
    new Map();

  public addEventListener(listener: Listener) {
    this.listeners_.push(listener);
  }

  public addProvider(provider: EventProvider) {
    if (this.domListeners_.has(provider)) {
      Logger.warn("EventDispatcher", `Provider ${provider} already registered`);
      return;
    }

    const domHandler = this.createHandler(provider);
    this.domListeners_.set(provider, domHandler);

    eventTypes.forEach((type) => {
      provider.element.addEventListener(type, domHandler, { passive: false });
    });
  }

  public removeProvider(provider: EventProvider) {
    if (!this.domListeners_.has(provider)) {
      Logger.warn(
        "EventDispatcher",
        `Provider ${provider} not found for removal`
      );
      return;
    }

    const domHandler = this.domListeners_.get(provider);
    if (domHandler) {
      eventTypes.forEach((type) => {
        provider.element.removeEventListener(type, domHandler);
      });
      this.domListeners_.delete(provider);
    }
  }

  private createHandler(provider: EventProvider): DOMEventListener {
    return (e: Event) => {
      const baseEventContext = EventContext.fromDOMEvent(e);
      if (!baseEventContext) {
        return;
      }

      // let provider process the context (augment + handle internal distribution) first
      const eventContext = provider.processEvent(baseEventContext);
      if (eventContext.propagationStopped) {
        return;
      }

      // distribute provider-augmented context to global listeners if not stopped
      for (const listener of this.listeners_) {
        listener(eventContext);
        if (eventContext.propagationStopped) return;
      }
    };
  }
}
