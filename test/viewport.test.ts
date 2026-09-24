import { expect, test } from "vitest";

import { Viewport, ViewportProps, parseViewportProps } from "@/core/viewport";
import {
  createTestElement,
  createTestCamera,
  createTestContext,
} from "./helpers";

test("Viewport constructor uses provided ID", () => {
  const element = createTestElement("test-element");
  const camera = createTestCamera();
  const context = createTestContext();

  const viewport = new Viewport({
    id: "custom-viewport",
    element,
    camera,
    context,
  });
  expect(viewport.id).toBe("custom-viewport");
});

test("Viewport constructor falls back to element ID", () => {
  const element = createTestElement("element-id");
  const camera = createTestCamera();
  const context = createTestContext();

  const viewport = new Viewport({
    id: "element-id",
    element,
    camera,
    context,
  });
  expect(viewport.id).toBe("element-id");
});

test("Viewport constructor requires an ID", () => {
  const element = createTestElement("");
  element.id = ""; // Ensure no ID
  const camera = createTestCamera();
  const context = createTestContext();

  const viewport = new Viewport({
    id: "generated-id",
    element,
    camera,
    context,
  });
  expect(viewport.id).toBe("generated-id");
});

test("parseViewportProps creates viewports with validation", () => {
  const canvas = document.createElement("canvas");
  const element1 = createTestElement("viewport1");
  const element2 = createTestElement("viewport2");
  const camera1 = createTestCamera();
  const camera2 = createTestCamera();
  const context = createTestContext();

  const configs: ViewportProps[] = [
    { id: "viewport1", element: element1, camera: camera1 },
    { id: "viewport2", element: element2, camera: camera2 },
  ];

  const viewports = parseViewportProps(configs, canvas, context);

  expect(viewports).toHaveLength(2);
  expect(viewports[0].id).toBe("viewport1");
  expect(viewports[1].id).toBe("viewport2");
  expect(viewports[0].element).toBe(element1);
  expect(viewports[1].element).toBe(element2);
});

test("parseViewportProps throws on duplicate IDs", () => {
  const canvas = document.createElement("canvas");
  const element1 = createTestElement("viewport1");
  const element2 = createTestElement("viewport2");
  const camera1 = createTestCamera();
  const camera2 = createTestCamera();
  const context = createTestContext();

  const configs: ViewportProps[] = [
    { id: "duplicate", element: element1, camera: camera1 },
    { id: "duplicate", element: element2, camera: camera2 },
  ];

  expect(() => parseViewportProps(configs, canvas, context)).toThrow(
    'Duplicate viewport ID "duplicate"'
  );
});

test("parseViewportProps throws on shared elements", () => {
  const canvas = document.createElement("canvas");
  const sharedElement = createTestElement("shared");
  const camera1 = createTestCamera();
  const camera2 = createTestCamera();
  const context = createTestContext();

  const configs: ViewportProps[] = [
    { id: "viewport1", element: sharedElement, camera: camera1 },
    { id: "viewport2", element: sharedElement, camera: camera2 },
  ];

  expect(() => parseViewportProps(configs, canvas, context)).toThrow(
    "Multiple viewports cannot share the same HTML element"
  );
});

test("parseViewportProps allows viewports without explicit IDs", () => {
  const canvas = document.createElement("canvas");
  const element1 = createTestElement("element1");
  const element2 = createTestElement("element2");
  const camera1 = createTestCamera();
  const camera2 = createTestCamera();
  const context = createTestContext();

  const configs: ViewportProps[] = [
    { element: element1, camera: camera1 },
    { element: element2, camera: camera2 },
  ];

  const viewports = parseViewportProps(configs, canvas, context);

  expect(viewports).toHaveLength(2);
  expect(viewports[0].id).toBe("element1");
  expect(viewports[1].id).toBe("element2");
});
