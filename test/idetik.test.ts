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
  const firstLayer = new TrackingLayer();
  const secondLayer = new TrackingLayer();
  const viewports = [
    new Viewport({
      id: "duplicate",
      domElement: createTestElement("first"),
      camera: createTestCamera(),
      layers: [firstLayer],
    }),
    new Viewport({
      id: "duplicate",
      domElement: createTestElement("second"),
      camera: createTestCamera(),
      layers: [secondLayer],
    }),
  ];

  expect(
    () =>
      new Idetik({
        canvas: document.createElement("canvas"),
        viewports,
      })
  ).toThrow('Duplicate viewport ID "duplicate"');
  expect(firstLayer.attachCount).toBe(0);
  expect(secondLayer.attachCount).toBe(0);
});

test("Runtime constructor rejects shared viewport elements before attachment", () => {
  const element = createTestElement("shared");
  const firstLayer = new TrackingLayer();
  const secondLayer = new TrackingLayer();
  const viewports = [
    new Viewport({
      id: "first",
      domElement: element,
      camera: createTestCamera(),
      layers: [firstLayer],
    }),
    new Viewport({
      id: "second",
      domElement: element,
      camera: createTestCamera(),
      layers: [secondLayer],
    }),
  ];

  expect(
    () =>
      new Idetik({
        canvas: document.createElement("canvas"),
        viewports,
      })
  ).toThrow("Multiple viewports cannot share the same HTML element");
  expect(firstLayer.attachCount).toBe(0);
  expect(secondLayer.attachCount).toBe(0);
});

test("addViewport rejects duplicate IDs without changing the runtime", () => {
  const first = new Viewport({
    id: "duplicate",
    domElement: createTestElement("first"),
    camera: createTestCamera(),
  });
  const idetik = new Idetik({
    canvas: document.createElement("canvas"),
    viewports: [first],
  });
  const layer = new TrackingLayer();
  const duplicate = new Viewport({
    id: "duplicate",
    domElement: createTestElement("second"),
    camera: createTestCamera(),
    layers: [layer],
  });

  expect(() => idetik.addViewport(duplicate)).toThrow(
    'Duplicate viewport ID "duplicate"'
  );
  expect(idetik.viewports).toEqual([first]);
  expect(layer.attachCount).toBe(0);
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
  const layer = new TrackingLayer();
  const shared = new Viewport({
    id: "second",
    domElement: element,
    camera: createTestCamera(),
    layers: [layer],
  });

  expect(() => idetik.addViewport(shared)).toThrow(
    "Multiple viewports cannot share the same HTML element"
  );
  expect(idetik.viewports).toEqual([first]);
  expect(layer.attachCount).toBe(0);
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

test("Runtime rejects shared layers before attachment", () => {
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

  expect(
    () =>
      new Idetik({
        canvas: document.createElement("canvas"),
        viewports: [first, second],
      })
  ).toThrow("TrackingLayer cannot be shared by multiple viewports");
  expect(layer.attachCount).toBe(0);
});

test("Runtime revalidates layers added between frames", () => {
  const first = new Viewport({
    id: "first",
    domElement: createTestElement("first"),
    camera: createTestCamera(),
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
  const layer = new TrackingLayer();
  first.addLayer(layer);
  second.addLayer(layer);
  let frame: FrameRequestCallback | undefined;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frame = callback;
    return 1;
  });

  idetik.start();
  expect(() => frame!(0)).toThrow(
    "TrackingLayer cannot be shared by multiple viewports"
  );
  expect(layer.attachCount).toBe(0);
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

test("Runtime rolls back layers when attachment fails", () => {
  const attachedLayer = new TrackingLayer();
  const failingLayer = new TrackingLayer();
  failingLayer.throwOnAttach = true;
  const viewport = new Viewport({
    domElement: createTestElement("viewport"),
    camera: createTestCamera(),
    layers: [attachedLayer, failingLayer],
  });
  const idetik = new Idetik({
    canvas: document.createElement("canvas"),
    viewports: [viewport],
  });
  let frame: FrameRequestCallback | undefined;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frame = callback;
    return 1;
  });

  idetik.start();
  expect(() => frame!(0)).toThrow("attach failed");
  expect(attachedLayer.attachCount).toBe(1);
  expect(attachedLayer.detachCount).toBe(1);
  expect(attachedLayer.attached).toBe(false);
  expect(failingLayer.attached).toBe(false);
  idetik.stop();
});
