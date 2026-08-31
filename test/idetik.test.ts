import { expect, test, vi } from "vitest";
import { Idetik } from "@/idetik";
import { OrthographicCamera } from "@/objects/cameras/orthographic_camera";
import { Viewport } from "@/core/viewport";
import { createTestCamera, createTestElement, TrackingLayer } from "./helpers";

function createViewport(canvas: HTMLCanvasElement, camera: OrthographicCamera) {
  return new Viewport({ element: canvas, camera });
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

test("Runtime rolls back failed viewports and permits reuse", () => {
  const layer = new TrackingLayer();
  const failingLayer = new TrackingLayer();
  failingLayer.throwOnAttach = true;
  const viewport = new Viewport({
    element: createTestElement("first"),
    camera: createTestCamera(),
    layers: [layer],
  });
  const failingViewport = new Viewport({
    element: createTestElement("failing"),
    camera: createTestCamera(),
    layers: [failingLayer],
  });

  expect(
    () =>
      new Idetik({
        canvas: document.createElement("canvas"),
        viewports: [viewport, failingViewport],
      })
  ).toThrow("attach failed");
  expect(layer.attachCount).toBe(1);
  expect(layer.detachCount).toBe(1);

  const first = new Idetik({
    canvas: document.createElement("canvas"),
    viewports: [viewport],
  });
  expect(first.removeViewport(viewport)).toBe(true);

  const second = new Idetik({
    canvas: document.createElement("canvas"),
    viewports: [viewport],
  });
  expect(layer.attachCount).toBe(3);
  expect(second.removeViewport(viewport)).toBe(true);
  expect(layer.detachCount).toBe(3);
});
