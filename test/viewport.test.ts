import { expect, test } from "vitest";

import { Viewport } from "@/core/viewport";
import {
  createTestCamera,
  createTestContext,
  createTestElement,
  TrackingLayer,
} from "./helpers";

function createViewport(id: string, element = createTestElement(id)): Viewport {
  return new Viewport({ id, domElement: element, camera: createTestCamera() });
}

test("Viewport constructor uses the provided ID", () => {
  const viewport = createViewport("custom-viewport");
  expect(viewport.id).toBe("custom-viewport");
});

test("Viewport constructor falls back to the element ID", () => {
  const element = createTestElement("element-id");
  const viewport = new Viewport({
    domElement: element,
    camera: createTestCamera(),
  });
  expect(viewport.id).toBe("element-id");
});

test("Viewport constructor generates an ID when none is provided", () => {
  const element = createTestElement("");
  const viewport = new Viewport({
    domElement: element,
    camera: createTestCamera(),
  });
  expect(viewport.id).not.toBe("");
});

test("Viewport layer mutations do not require a runtime", () => {
  const first = new TrackingLayer();
  const second = new TrackingLayer();
  const viewport = new Viewport({
    domElement: createTestElement(),
    camera: createTestCamera(),
    layers: [first],
  });

  viewport.addLayer(second);
  expect(viewport.layers).toEqual([first, second]);
  expect(first.attachCount).toBe(0);
  expect(second.attachCount).toBe(0);

  viewport.removeLayer(first);
  expect(viewport.layers).toEqual([second]);
  expect(first.detachCount).toBe(0);
});

test("Viewport layer removal eagerly detaches attached layers", () => {
  const first = new TrackingLayer();
  const second = new TrackingLayer();
  const viewport = new Viewport({
    domElement: createTestElement(),
    camera: createTestCamera(),
    layers: [first, second],
  });
  const context = createTestContext();
  first.onAttached(context, viewport);
  second.onAttached(context, viewport);

  viewport.removeLayer(first);
  expect(first.detachCount).toBe(1);

  viewport.removeAllLayers();
  expect(second.detachCount).toBe(1);
  expect(viewport.layers).toEqual([]);
});
