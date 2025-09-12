import { describe, it, expect, vi } from "vitest";
import {
  EventDispatcher,
  EventContext,
  EventProvider,
} from "../src/core/event_dispatcher";
import { OrthographicCamera } from "../src/objects/cameras/orthographic_camera";
import { Layer } from "../src/core/layer";
import { Idetik } from "../src/idetik";

class TestLayer extends Layer {
  public readonly type = "test";
  private shouldStopPropagation_ = false;

  constructor(shouldStop = false) {
    super({});
    this.shouldStopPropagation_ = shouldStop;
  }

  public update() {}

  public onEvent(event: EventContext) {
    if (this.shouldStopPropagation_) {
      event.stopPropagation();
    }
  }
}

class TestEventProvider implements EventProvider {
  public eventProcessed = false;
  public readonly element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  processEvent(eventContext: EventContext): EventContext {
    this.eventProcessed = true;
    const augmented = new EventContext(
      eventContext.type,
      eventContext.event,
      eventContext.clientPos,
      eventContext.worldPos,
      eventContext.clipPos,
      this
    );
    augmented.stopPropagation();
    return augmented;
  }
}

describe("EventProvider architecture", () => {
  it("providers can stop propagation to prevent global listeners", () => {
    const testDiv = document.createElement("div");
    const dispatcher = new EventDispatcher();

    const stoppingProvider = new TestEventProvider(testDiv);
    dispatcher.addProvider(stoppingProvider);

    const globalListener = vi.fn();
    dispatcher.addEventListener(globalListener);

    testDiv.dispatchEvent(new PointerEvent("pointerdown"));

    expect(stoppingProvider.eventProcessed).toBe(true);
    expect(globalListener).not.toHaveBeenCalled();
  });

  it("providers handle events independently", () => {
    const div1 = document.createElement("div");
    const div2 = document.createElement("div");
    const dispatcher = new EventDispatcher();

    const provider1 = new TestEventProvider(div1);
    const provider2 = new TestEventProvider(div2);

    dispatcher.addProvider(provider1);
    dispatcher.addProvider(provider2);

    div1.dispatchEvent(new PointerEvent("pointerdown"));

    expect(provider1.eventProcessed).toBe(true);
    expect(provider2.eventProcessed).toBe(false);
  });

  it("viewport provider adds coordinate transformations", () => {
    const canvas = document.createElement("canvas");
    Object.defineProperty(canvas, "getBoundingClientRect", {
      value: () => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        right: 800,
        bottom: 600,
      }),
    });

    const camera = new OrthographicCamera(0, 800, 0, 600);
    const idetik = new Idetik({ canvas, camera });

    let receivedEvent: EventContext | null = null;
    idetik.events.addEventListener((event) => {
      receivedEvent = event;
    });

    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 400,
        clientY: 300,
      })
    );

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent!.worldPos).toBeDefined();
    expect(receivedEvent!.clipPos).toBeDefined();

    // Ensure coordinates are valid numbers, not NaN
    expect(Number.isNaN(receivedEvent!.worldPos![0])).toBe(false);
    expect(Number.isNaN(receivedEvent!.worldPos![1])).toBe(false);
    expect(Number.isNaN(receivedEvent!.worldPos![2])).toBe(false);
    expect(Number.isNaN(receivedEvent!.clipPos![0])).toBe(false);
    expect(Number.isNaN(receivedEvent!.clipPos![1])).toBe(false);
    expect(Number.isNaN(receivedEvent!.clipPos![2])).toBe(false);
  });

  it("layers can stop propagation", () => {
    const canvas = document.createElement("canvas");
    const camera = new OrthographicCamera(0, 800, 0, 600);

    const stoppingLayer = new TestLayer(true);
    const idetik = new Idetik({ canvas, camera, layers: [stoppingLayer] });

    const globalListener = vi.fn();
    idetik.events.addEventListener(globalListener);

    canvas.dispatchEvent(new PointerEvent("pointerdown"));

    expect(globalListener).not.toHaveBeenCalled();
  });
});
