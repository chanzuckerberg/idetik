import { expect, test } from "vitest";

import { Viewport, validateViewports } from "@/core/viewport";
import {
  createTestCamera,
  createTestContext,
  createTestElement,
  TrackingLayer,
} from "./helpers";

function createViewport(id: string, element = createTestElement(id)): Viewport {
  return new Viewport({ id, element, camera: createTestCamera() });
}

test("Viewport constructor uses the provided ID", () => {
  const viewport = createViewport("custom-viewport");
  expect(viewport.id).toBe("custom-viewport");
});

test("Viewport constructor falls back to the element ID", () => {
  const element = createTestElement("element-id");
  const viewport = new Viewport({ element, camera: createTestCamera() });
  expect(viewport.id).toBe("element-id");
});

test("Viewport constructor generates an ID when none is provided", () => {
  const element = createTestElement("");
  const viewport = new Viewport({ element, camera: createTestCamera() });
  expect(viewport.id).not.toBe("");
});

test("validateViewports rejects duplicate IDs", () => {
  const viewports = [
    createViewport("duplicate"),
    createViewport("duplicate", createTestElement("second")),
  ];

  expect(() => validateViewports(viewports)).toThrow(
    'Duplicate viewport ID "duplicate"'
  );
});

test("validateViewports rejects shared elements", () => {
  const element = createTestElement("shared");
  const viewports = [
    createViewport("viewport1", element),
    createViewport("viewport2", element),
  ];

  expect(() => validateViewports(viewports)).toThrow(
    "Multiple viewports cannot share the same HTML element"
  );
});

test("Viewport attaches and detaches layers with Idetik", () => {
  const initial = new TrackingLayer();
  const beforeAttach = new TrackingLayer();
  const afterAttach = new TrackingLayer();
  const viewport = new Viewport({
    element: createTestElement(),
    camera: createTestCamera(),
    layers: [initial],
  });

  viewport.addLayer(beforeAttach);
  expect(initial.attachCount).toBe(0);
  expect(beforeAttach.attachCount).toBe(0);

  viewport.attachToIdetik(createTestContext());
  expect(initial.attachCount).toBe(1);
  expect(beforeAttach.attachCount).toBe(1);

  viewport.addLayer(afterAttach);
  expect(afterAttach.attachCount).toBe(1);

  viewport.removeAllLayers();
  expect(initial.detachCount).toBe(1);
  expect(beforeAttach.detachCount).toBe(1);
  expect(afterAttach.detachCount).toBe(1);
});

test("Viewport rolls back a failed attachment", () => {
  const attached = new TrackingLayer();
  const failing = new TrackingLayer();
  failing.throwOnAttach = true;
  const viewport = new Viewport({
    element: createTestElement(),
    camera: createTestCamera(),
    layers: [attached, failing],
  });
  const context = createTestContext();

  expect(() => viewport.attachToIdetik(context)).toThrow("attach failed");
  expect(attached.attachCount).toBe(1);
  expect(attached.detachCount).toBe(1);

  failing.throwOnAttach = false;
  expect(() => viewport.attachToIdetik(context)).not.toThrow();
  expect(() => viewport.attachToIdetik(context)).toThrow(
    `Viewport "${viewport.id}" is already attached`
  );
  viewport.detachFromIdetik();
  expect(attached.detachCount).toBe(2);
  expect(failing.detachCount).toBe(1);
});
