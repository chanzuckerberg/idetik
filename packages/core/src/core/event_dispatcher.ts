export interface EventContext {
  readonly type: string;
  readonly event: Event;
  readonly propagationStopped: boolean;
  stopPropagation(): void;
}

type Listener = (event: EventContext) => void;

export class EventDispatcher {
  private readonly listeners_: Listener[] = [];

  constructor(canvas: HTMLCanvasElement) {
    [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "wheel",
    ].forEach((type) => {
      canvas.addEventListener(type, this.handleEvent, { passive: false });
    });
  }

  public onEvent(listener: Listener) {
    this.listeners_.push(listener);
  }

  private readonly handleEvent = (e: Event) => {
    let stopped = false;

    const event: EventContext = {
      type: e.type,
      event: e,
      get propagationStopped() {
        return stopped;
      },
      stopPropagation() {
        stopped = true;
      },
    };

    for (const listener of this.listeners_) {
      listener(event);
      if (event.propagationStopped) break;
    }
  };
}
