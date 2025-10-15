import { expect, test } from "vitest";

import {
  Viewport,
  ViewportConfig,
  parseViewportConfigs,
  LayerManager,
  OrthographicCamera,
} from "@";

function createTestElement(id: string): HTMLElement {
  const element = document.createElement("div");
  element.id = id;
  return element;
}

function createTestCamera(): OrthographicCamera {
  return new OrthographicCamera(-1, 1, -1, 1);
}

test("Viewport constructor uses provided ID", () => {
  const element = createTestElement("test-element");
  const camera = createTestCamera();
  const layerManager = new LayerManager();

  const config: ViewportConfig = {
    id: "custom-viewport",
    element,
    camera,
  };

  const viewport = new Viewport(
    config as Required<Pick<ViewportConfig, "element" | "camera">> &
      ViewportConfig,
    layerManager
  );
  expect(viewport.id).toBe("custom-viewport");
});

test("Viewport constructor falls back to element ID", () => {
  const element = createTestElement("element-id");
  const camera = createTestCamera();
  const layerManager = new LayerManager();

  const config: ViewportConfig = {
    element,
    camera,
  };

  const viewport = new Viewport(
    config as Required<Pick<ViewportConfig, "element" | "camera">> &
      ViewportConfig,
    layerManager
  );
  expect(viewport.id).toBe("element-id");
});

test("Viewport constructor generates a fallback ID when not provided or available", () => {
  const element = createTestElement("");
  element.id = ""; // Ensure no ID
  const camera = createTestCamera();
  const layerManager = new LayerManager();

  const config: ViewportConfig = {
    element,
    camera,
  };

  const viewport = new Viewport(
    config as Required<Pick<ViewportConfig, "element" | "camera">> &
      ViewportConfig,
    layerManager
  );
  expect(viewport.id).toBeDefined();
  expect(viewport.id.length).toBeGreaterThan(0);
});

test("parseViewportConfigs creates viewports with validation", () => {
  const canvas = document.createElement("canvas");
  const element1 = createTestElement("viewport1");
  const element2 = createTestElement("viewport2");
  const camera1 = createTestCamera();
  const camera2 = createTestCamera();

  const configs: ViewportConfig[] = [
    { id: "viewport1", element: element1, camera: camera1 },
    { id: "viewport2", element: element2, camera: camera2 },
  ];

  const viewports = parseViewportConfigs(
    configs,
    canvas,
    () => new LayerManager()
  );

  expect(viewports).toHaveLength(2);
  expect(viewports[0].id).toBe("viewport1");
  expect(viewports[1].id).toBe("viewport2");
  expect(viewports[0].element).toBe(element1);
  expect(viewports[1].element).toBe(element2);
});

test("parseViewportConfigs throws on duplicate IDs", () => {
  const canvas = document.createElement("canvas");
  const element1 = createTestElement("viewport1");
  const element2 = createTestElement("viewport2");
  const camera1 = createTestCamera();
  const camera2 = createTestCamera();

  const configs: ViewportConfig[] = [
    { id: "duplicate", element: element1, camera: camera1 },
    { id: "duplicate", element: element2, camera: camera2 },
  ];

  expect(() =>
    parseViewportConfigs(configs, canvas, () => new LayerManager())
  ).toThrow('Duplicate viewport ID "duplicate"');
});

test("parseViewportConfigs throws on shared elements", () => {
  const canvas = document.createElement("canvas");
  const sharedElement = createTestElement("shared");
  const camera1 = createTestCamera();
  const camera2 = createTestCamera();

  const configs: ViewportConfig[] = [
    { id: "viewport1", element: sharedElement, camera: camera1 },
    { id: "viewport2", element: sharedElement, camera: camera2 },
  ];

  expect(() =>
    parseViewportConfigs(configs, canvas, () => new LayerManager())
  ).toThrow("Multiple viewports cannot share the same HTML element");
});

test("parseViewportConfigs allows viewports without explicit IDs", () => {
  const canvas = document.createElement("canvas");
  const element1 = createTestElement("element1");
  const element2 = createTestElement("element2");
  const camera1 = createTestCamera();
  const camera2 = createTestCamera();

  const configs: ViewportConfig[] = [
    { element: element1, camera: camera1 },
    { element: element2, camera: camera2 },
  ];

  const viewports = parseViewportConfigs(
    configs,
    canvas,
    () => new LayerManager()
  );

  expect(viewports).toHaveLength(2);
  expect(viewports[0].id).toBe("element1");
  expect(viewports[1].id).toBe("element2");
});
