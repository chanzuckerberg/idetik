import { expect, test, vi } from "vitest";
import { Idetik } from "@/idetik";
import { OrthographicCamera } from "@/objects/cameras/orthographic_camera";

test("Runtime initializes with canvas element", () => {
  const canvas = document.createElement("canvas");
  const camera = new OrthographicCamera({
    left: 0,
    right: 128,
    top: 0,
    bottom: 128,
  });

  const idetik = new Idetik({ canvas, viewports: [{ camera }] });

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
  const idetik = new Idetik({ canvas, viewports: [{ camera }] });

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
  const idetik = new Idetik({ canvas, viewports: [{ camera }] });

  expect(idetik.width).toBe(canvas.clientWidth * devicePixelRatio);
  expect(idetik.height).toBe(canvas.clientHeight * devicePixelRatio);
});

test("pixelRatio option sizes the drawing buffer independently of the display", () => {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width: 200px; height: 100px;";
  document.body.appendChild(canvas);
  const camera = new OrthographicCamera({
    left: 0,
    right: 128,
    top: 0,
    bottom: 128,
  });

  const idetik = new Idetik({
    canvas,
    pixelRatio: 0.5,
    viewports: [{ camera }],
  });

  expect(idetik.width).toBe(100);
  expect(idetik.height).toBe(50);
  expect(canvas.width).toBe(100);
  expect(canvas.height).toBe(50);

  canvas.remove();
});

test("pixelRatio option rejects non-positive values", () => {
  const canvas = document.createElement("canvas");
  const camera = new OrthographicCamera({
    left: 0,
    right: 128,
    top: 0,
    bottom: 128,
  });

  expect(
    () => new Idetik({ canvas, pixelRatio: 0, viewports: [{ camera }] })
  ).toThrow("pixel ratio must be a positive number");
  expect(
    () => new Idetik({ canvas, pixelRatio: NaN, viewports: [{ camera }] })
  ).toThrow("pixel ratio must be a positive number");
});
