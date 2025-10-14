import { expect, test, vi } from "vitest";
import { Idetik } from "@/idetik";
import { OrthographicCamera } from "@/objects/cameras/orthographic_camera";

test("Runtime constructor throws error when neither canvas nor canvasSelector provided", () => {
  const camera = new OrthographicCamera(0, 128, 0, 128);

  expect(() => {
    new Idetik({ viewports: [{ camera }] });
  }).toThrow("Either canvas or canvasSelector must be provided");
});

test("Runtime constructor throws error when both canvas and canvasSelector provided", () => {
  const canvas = document.createElement("canvas");
  const camera = new OrthographicCamera(0, 128, 0, 128);

  expect(() => {
    new Idetik({
      canvas,
      canvasSelector: "#canvas",
      viewports: [{ camera }],
    });
  }).toThrow("Cannot provide both canvas and canvasSelector");
});

test("Runtime constructor throws error when canvas not found with selector", () => {
  const camera = new OrthographicCamera(0, 128, 0, 128);

  expect(() => {
    new Idetik({
      canvasSelector: "#non-existent-canvas",
      viewports: [{ camera }],
    });
  }).toThrow("Canvas not found: #non-existent-canvas");
});

test("Runtime initializes with canvas element", () => {
  const canvas = document.createElement("canvas");
  const camera = new OrthographicCamera(0, 128, 0, 128);

  const idetik = new Idetik({ canvas, viewports: [{ camera }] });

  expect(idetik.canvas).toBe(canvas);
  expect(idetik.viewports[0].camera).toBe(camera);
  expect(idetik.viewports[0].layerManager).toBeDefined();
});

test("Runtime initializes with canvas selector", () => {
  const canvas = document.createElement("canvas");
  canvas.id = "test-canvas";
  document.body.appendChild(canvas);

  const camera = new OrthographicCamera(0, 128, 0, 128);

  const idetik = new Idetik({
    canvasSelector: "#test-canvas",
    viewports: [{ camera }],
  });

  expect(idetik.canvas).toBe(canvas);
  expect(idetik.viewports[0].camera).toBe(camera);
  expect(idetik.viewports[0].layerManager).toBeDefined();

  document.body.removeChild(canvas);
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
