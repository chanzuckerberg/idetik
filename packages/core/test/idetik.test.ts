import { expect, test, vi } from "vitest";
import { Idetik } from "@/idetik";
import { OrthographicCamera } from "@/objects/cameras/orthographic_camera";

test("Runtime initializes with canvas element", () => {
  const canvas = document.createElement("canvas");
  const camera = new OrthographicCamera(0, 128, 0, 128);

  const idetik = new Idetik({ canvas, viewports: [{ camera }] });

  const viewport = idetik.viewports[0];
  expect(idetik.canvas).toBe(canvas);
  expect(viewport.camera).toBe(camera);
  expect(viewport.layerManager).toBeDefined();
});

test("Runtime start/stop controls the animation loop", () => {
  const canvas = document.createElement("canvas");
  const camera = new OrthographicCamera(0, 128, 0, 128);
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
  const camera = new OrthographicCamera(0, 128, 0, 128);
  const idetik = new Idetik({ canvas, viewports: [{ camera }] });

  expect(idetik.width).toBe(canvas.clientWidth * devicePixelRatio);
  expect(idetik.height).toBe(canvas.clientHeight * devicePixelRatio);
});
