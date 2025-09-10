import { describe, it, expect, vi } from "vitest";
import {
  EventDispatcher,
  EventContext,
  EventProvider,
  CanvasEventProvider,
} from "../src/core/event_dispatcher";
import { OrthographicCamera } from "../src/objects/cameras/orthographic_camera";
import { Layer } from "../src/core/layer";
import { Idetik } from "../src/idetik";
import { vec2, vec3 } from "gl-matrix";

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
  public stopsPropagation = false;
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
  it("EventProvider can stop propagation to prevent global listeners", () => {
    const testDiv = document.createElement("div");
    const dispatcher = new EventDispatcher();

    const stoppingProvider = new TestEventProvider(testDiv);
    stoppingProvider.stopsPropagation = true;
    dispatcher.addProvider(stoppingProvider);

    const globalListener = vi.fn();
    dispatcher.addEventListener(globalListener);

    const pointerEvent = new PointerEvent("pointerdown", {
      clientX: 100,
      clientY: 200,
    });
    testDiv.dispatchEvent(pointerEvent);

    expect(stoppingProvider.eventProcessed).toBe(true);
    expect(globalListener).not.toHaveBeenCalled();
  });

  it("Multiple EventProviders process events independently", () => {
    const div1 = document.createElement("div");
    const div2 = document.createElement("div");
    const dispatcher = new EventDispatcher();

    const provider1 = new TestEventProvider(div1);
    const provider2 = new TestEventProvider(div2);

    dispatcher.addProvider(provider1);
    dispatcher.addProvider(provider2);

    const pointerEvent = new PointerEvent("pointerdown", {
      clientX: 50,
      clientY: 75,
    });
    div1.dispatchEvent(pointerEvent);

    expect(provider1.eventProcessed).toBe(true);
    expect(provider2.eventProcessed).toBe(false);
  });

  it("Viewport provider adds world/clip coordinates", () => {
    const canvas = document.createElement("canvas");
    // Mock getBoundingClientRect to return specific dimensions
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

    const camera = new OrthographicCamera(0, 800, 0, 600, 0, 100);
    const idetik = new Idetik({ canvas, camera });

    // add a global event listener
    let receivedEvent: EventContext | null = null;
    idetik.events.addEventListener((event) => {
      receivedEvent = event;
    });

    const pointerEvent = new PointerEvent("pointerdown", {
      clientX: 400,
      clientY: 300,
    });
    canvas.dispatchEvent(pointerEvent);

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent!.clientPos).toEqual(vec2.fromValues(400, 300));
    // default clip depth for events is 0 (no picking is done by default)
    expect(receivedEvent!.clipPos).toEqual(vec3.fromValues(0, 0, 0));
    // -50 is the center of the orthographic camera near/far range
    expect(receivedEvent!.worldPos).toEqual(vec3.fromValues(400, 300, -50));
  });

  it("Fallback canvas provider does not add clip/world coordinates", () => {
    const canvas = document.createElement("canvas");
    const dispatcher = new EventDispatcher();

    const canvasProvider = new CanvasEventProvider(canvas);
    dispatcher.addProvider(canvasProvider);

    let receivedEvent: EventContext | null = null;
    dispatcher.addEventListener((event) => {
      receivedEvent = event;
    });

    const pointerEvent = new PointerEvent("pointerdown", {
      clientX: 150,
      clientY: 250,
    });
    canvas.dispatchEvent(pointerEvent);

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent!.source).toBeDefined();
    expect(receivedEvent!.source?.element).toBe(canvas);
    expect(receivedEvent!.worldPos).toBeUndefined();
    expect(receivedEvent!.clipPos).toBeUndefined();
    expect(receivedEvent!.clientPos).toEqual(vec2.fromValues(150, 250));
  });

  it("Layer can stop propagation within viewport processing", () => {
    const canvas = document.createElement("canvas");
    const camera = new OrthographicCamera(0, 800, 0, 600);

    const stoppingLayer = new TestLayer(true);
    const idetik = new Idetik({
      canvas,
      camera,
      layers: [stoppingLayer],
    });

    // global listener should not be called due to layer stopping propagation
    const globalListener = vi.fn();
    idetik.events.addEventListener(globalListener);

    const pointerEvent = new PointerEvent("pointerdown", {
      clientX: 400,
      clientY: 300,
    });
    canvas.dispatchEvent(pointerEvent);

    expect(globalListener).not.toHaveBeenCalled();
  });

  it("EventContext.fromDOMEvent creates valid context for supported event", () => {
    const pointerEvent = new PointerEvent("pointermove", {
      clientX: 123,
      clientY: 456,
    });

    const context = EventContext.fromDOMEvent(pointerEvent);

    expect(context).not.toBeNull();
    expect(context!.type).toBe("pointermove");
    expect(context!.event).toBe(pointerEvent);
    expect(context!.clientPos).toEqual(vec2.fromValues(123, 456));
    expect(context!.worldPos).toBeUndefined();
    expect(context!.clipPos).toBeUndefined();
    expect(context!.source).toBeUndefined();
    expect(context!.propagationStopped).toBe(false);
  });

  it("EventContext.fromDOMEvent returns null for unsupported event types", () => {
    const customEvent = new CustomEvent("unsupported");
    const context = EventContext.fromDOMEvent(customEvent);
    expect(context).toBeNull();
  });

  it("EventContext handles events without client coordinates", () => {
    const wheelEvent = new WheelEvent("wheel", {
      // a supported event type, but explicitly not setting clientX/clientY
    });

    const context = EventContext.fromDOMEvent(wheelEvent);

    expect(context).not.toBeNull();

    // Should default to (0, 0) when no client coordinates
    expect(context!.clientPos).toEqual(vec2.fromValues(0, 0));
  });
});
