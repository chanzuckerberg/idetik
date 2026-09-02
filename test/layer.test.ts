import { expect, test, vi } from "vitest";

import { Layer } from "@/core/layer";
import { Viewport } from "@/core/viewport";
import { IdetikContext } from "@/idetik";

class TestLayer extends Layer {
  public readonly type = "TestLayer";

  public attachCount = 0;
  public detachCount = 0;
  public throwOnAttach = false;

  public update() {}

  public setStateReady() {
    this.setState("ready");
  }

  protected attach() {
    if (this.throwOnAttach) throw new Error("attach failed");
    this.attachCount++;
  }

  protected detach() {
    this.detachCount++;
  }
}

const context = {} as IdetikContext;
const viewport = {} as Viewport;
const otherViewport = {} as Viewport;

test("Default layer state is 'initialized'", () => {
  const layer = new TestLayer();

  expect(layer.state).toBe("initialized");
});

test("Add state change callback", () => {
  const layer = new TestLayer();
  const callback = vi.fn();
  layer.addStateChangeCallback(callback);
  layer.setStateReady();

  expect(callback).toHaveBeenCalledWith("ready", "initialized");
});

test("Remove state change callback", () => {
  const layer = new TestLayer();
  const callback = vi.fn();
  layer.addStateChangeCallback(callback);
  layer.removeStateChangeCallback(callback);
  layer.setStateReady();

  expect(callback).toHaveBeenCalledTimes(0);
});

test("Removing an unregistered callback throws and keeps registered ones", () => {
  const layer = new TestLayer();
  const registered = vi.fn();
  const unregistered = vi.fn();
  layer.addStateChangeCallback(registered);

  expect(() => layer.removeStateChangeCallback(unregistered)).toThrow(
    "Callback to remove could not be found"
  );

  layer.setStateReady();
  expect(registered).toHaveBeenCalledWith("ready", "initialized");
});

test("Attaching to a second viewport while attached throws", () => {
  const layer = new TestLayer();
  layer.onAttached(context, viewport);

  expect(() => layer.onAttached(context, otherViewport)).toThrow(
    "TestLayer cannot be attached to multiple viewports simultaneously."
  );
  expect(layer.attachCount).toBe(1);
});

test("onDetached is a no-op when not attached", () => {
  const layer = new TestLayer();
  layer.onDetached(viewport);

  expect(layer.detachCount).toBe(0);
});

test("onDetached ignores a viewport that does not own the attachment", () => {
  const layer = new TestLayer();
  layer.onAttached(context, viewport);

  layer.onDetached(otherViewport);

  expect(layer.detachCount).toBe(0);
  expect(layer.attached).toBe(true);
});

test("Re-attaching after detach is allowed", () => {
  const layer = new TestLayer();
  layer.onAttached(context, viewport);
  layer.onDetached(viewport);

  expect(() => layer.onAttached(context, viewport)).not.toThrow();
  expect(layer.attachCount).toBe(2);
});

test("A failed attach does not mark the layer as attached", () => {
  const layer = new TestLayer();
  layer.throwOnAttach = true;
  expect(() => layer.onAttached(context, viewport)).toThrow("attach failed");

  // onDetached must be a no-op — the layer was never fully attached.
  layer.onDetached(viewport);
  expect(layer.detachCount).toBe(0);
});
