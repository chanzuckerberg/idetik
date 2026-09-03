import { expect, test, vi } from "vitest";
import { Idetik } from "@/idetik";
import { OrthographicCamera } from "@/objects/cameras/orthographic_camera";
import { Viewport } from "@/core/viewport";
import { createTestCamera, createTestElement, TrackingLayer } from "./helpers";

function createViewport(canvas: HTMLCanvasElement, camera: OrthographicCamera) {
  return new Viewport({ domElement: canvas, camera });
}

test("Runtime initializes with canvas element", () => {
  const canvas = document.createElement("canvas");
  const camera = new OrthographicCamera({
    left: 0,
    right: 128,
    top: 0,
    bottom: 128,
  });

  const idetik = new Idetik({
    canvas,
    viewports: [createViewport(canvas, camera)],
  });

  const viewport = idetik.viewports[0];
  expect(idetik.canvas).toBe(canvas);
  expect(viewport.camera).toBe(camera);
  expect(viewport.layers).toEqual([]);
});

test("Runtime start/stop controls the animation loop", () => {
  const canvas = document.createElement("canvas");
  const camera = new OrthographicCamera({
    left: 0,
    right: 128,
    top: 0,
    bottom: 128,
  });
  const idetik = new Idetik({
    canvas,
    viewports: [createViewport(canvas, camera)],
  });

  const rafSpy = vi.spyOn(window, "requestAnimationFrame");
  idetik.start();
  expect(rafSpy).toHaveBeenCalled();

  const cancelRafSpy = vi.spyOn(window, "cancelAnimationFrame");
  idetik.stop();
  expect(cancelRafSpy).toHaveBeenCalled();
});

test("Width and height properties return (scaled) canvas shape", () => {
  const devicePixelRatio = window.devicePixelRatio;
  const canvas = document.createElement("canvas");
  const camera = new OrthographicCamera({
    left: 0,
    right: 128,
    top: 0,
    bottom: 128,
  });
  const idetik = new Idetik({
    canvas,
    viewports: [createViewport(canvas, camera)],
  });

  expect(idetik.width).toBe(canvas.clientWidth * devicePixelRatio);
  expect(idetik.height).toBe(canvas.clientHeight * devicePixelRatio);
});

test("Runtime constructor rejects duplicate viewport IDs before attachment", () => {
  const viewports = [
    new Viewport({
      id: "duplicate",
      domElement: createTestElement("first"),
      camera: createTestCamera(),
    }),
    new Viewport({
      id: "duplicate",
      domElement: createTestElement("second"),
      camera: createTestCamera(),
    }),
  ];

  expect(
    () =>
      new Idetik({
        canvas: document.createElement("canvas"),
        viewports,
      })
  ).toThrow('Duplicate viewport ID "duplicate"');
});

test("addViewport rejects shared elements without changing the runtime", () => {
  const element = createTestElement("shared");
  const first = new Viewport({
    id: "first",
    domElement: element,
    camera: createTestCamera(),
  });
  const idetik = new Idetik({
    canvas: document.createElement("canvas"),
    viewports: [first],
  });
  const shared = new Viewport({
    id: "second",
    domElement: element,
    camera: createTestCamera(),
  });

  expect(() => idetik.addViewport(shared)).toThrow(
    "Multiple viewports cannot share the same HTML element"
  );
  expect(idetik.viewports).toEqual([first]);
});

test("addViewport rejects shared layers without changing the runtime", () => {
  const layer = new TrackingLayer();
  const first = new Viewport({
    id: "first",
    domElement: createTestElement("first"),
    camera: createTestCamera(),
    layers: [layer],
  });
  const idetik = new Idetik({
    canvas: document.createElement("canvas"),
    viewports: [first],
  });
  const shared = new Viewport({
    id: "second",
    domElement: createTestElement("second"),
    camera: createTestCamera(),
    layers: [layer],
  });

  expect(() => idetik.addViewport(shared)).toThrow(
    "TrackingLayer cannot be shared by multiple viewports"
  );
  expect(idetik.viewports).toEqual([first]);
  expect(layer.attachCount).toBe(0);
});

test("Runtime attaches pending layers before rendering and detaches eagerly", () => {
  const firstLayer = new TrackingLayer();
  const viewport = new Viewport({
    domElement: createTestElement("first"),
    camera: createTestCamera(),
    layers: [firstLayer],
  });
  const idetik = new Idetik({
    canvas: document.createElement("canvas"),
    viewports: [viewport],
  });
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });

  idetik.start();
  expect(firstLayer.attachCount).toBe(0);

  frames.shift()!(0);
  expect(firstLayer.attachCount).toBe(1);

  const secondLayer = new TrackingLayer();
  viewport.addLayer(secondLayer);
  expect(secondLayer.attachCount).toBe(0);

  frames.shift()!(16);
  expect(firstLayer.attachCount).toBe(1);
  expect(secondLayer.attachCount).toBe(1);

  viewport.removeLayer(secondLayer);
  expect(secondLayer.detachCount).toBe(1);
  expect(idetik.removeViewport(viewport)).toBe(true);
  idetik.stop();
  expect(firstLayer.detachCount).toBe(1);
});

test("Runtime rejects layers added to another viewport between frames", () => {
  const layer = new TrackingLayer();
  const first = new Viewport({
    id: "first",
    domElement: createTestElement("first"),
    camera: createTestCamera(),
    layers: [layer],
  });
  const second = new Viewport({
    id: "second",
    domElement: createTestElement("second"),
    camera: createTestCamera(),
  });
  const idetik = new Idetik({
    canvas: document.createElement("canvas"),
    viewports: [first, second],
  });
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });

  idetik.start();
  frames.shift()!(0);
  second.addLayer(layer);

  expect(() => frames.shift()!(16)).toThrow(
    "TrackingLayer is already attached to another viewport"
  );
  expect(layer.attachCount).toBe(1);
  idetik.stop();
});

test("Runtime rejects layers attached to another runtime", () => {
  const layer = new TrackingLayer();
  const first = new Viewport({
    id: "first",
    domElement: createTestElement("first"),
    camera: createTestCamera(),
    layers: [layer],
  });
  const second = new Viewport({
    id: "second",
    domElement: createTestElement("second"),
    camera: createTestCamera(),
    layers: [layer],
  });
  const firstRuntime = new Idetik({
    canvas: document.createElement("canvas"),
    viewports: [first],
  });
  const secondRuntime = new Idetik({
    canvas: document.createElement("canvas"),
    viewports: [second],
  });
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });

  firstRuntime.start();
  secondRuntime.start();
  frames.shift()!(0);
  expect(layer.attachCount).toBe(1);

  expect(() => frames.shift()!(0)).toThrow(
    "TrackingLayer is already attached to another viewport or Idetik runtime"
  );
  expect(layer.attachCount).toBe(1);

  secondRuntime.removeViewport(second);
  expect(layer.detachCount).toBe(0);
  firstRuntime.removeViewport(first);
  expect(layer.detachCount).toBe(1);
  firstRuntime.stop();
  secondRuntime.stop();
});

test("Inactive viewport removal does not detach the active viewport layer", () => {
  const layer = new TrackingLayer();
  const active = new Viewport({
    id: "active",
    domElement: createTestElement("active"),
    camera: createTestCamera(),
    layers: [layer],
  });
  const inactive = new Viewport({
    id: "inactive",
    domElement: createTestElement("inactive"),
    camera: createTestCamera(),
    layers: [layer],
  });
  const idetik = new Idetik({
    canvas: document.createElement("canvas"),
    viewports: [active],
  });
  let frame: FrameRequestCallback | undefined;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frame = callback;
    return 1;
  });

  idetik.start();
  frame!(0);
  inactive.removeLayer(layer);

  expect(layer.attached).toBe(true);
  expect(layer.detachCount).toBe(0);

  idetik.removeViewport(active);
  expect(layer.detachCount).toBe(1);
  idetik.stop();
});
