import { expect, test, vi } from "vitest";

import { Layer } from "@/core/layer";
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

test("Attaching to a second viewport while attached throws", () => {
  const layer = new TestLayer();
  layer.onAttached(context);

  expect(() => layer.onAttached(context)).toThrow(
    "TestLayer cannot be attached to multiple viewports simultaneously."
  );
  expect(layer.attachCount).toBe(1);
});

test("onDetached is a no-op when not attached", () => {
  const layer = new TestLayer();
  layer.onDetached(context);

  expect(layer.detachCount).toBe(0);
});

test("Re-attaching after detach is allowed", () => {
  const layer = new TestLayer();
  layer.onAttached(context);
  layer.onDetached(context);

  expect(() => layer.onAttached(context)).not.toThrow();
  expect(layer.attachCount).toBe(2);
});

test("A failed attach does not mark the layer as attached", () => {
  const layer = new TestLayer();
  layer.throwOnAttach = true;
  expect(() => layer.onAttached(context)).toThrow("attach failed");

  // onDetached must be a no-op — the layer was never fully attached.
  layer.onDetached(context);
  expect(layer.detachCount).toBe(0);
});
