import { afterAll, beforeAll, expect, test, vi } from "vitest";

import { WebGLRenderer } from "@";

beforeAll(() => {
  // "Instantiate WebGLRenderer with no WebGL context" throws an unhandled error when Renderer's
  // ResizeObserver callback is executed. This is expected due to there being no context, but can't
  // be properly caught in the test because it executes after the test function asynchronously.
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(() => ({ observe: () => {} }))
  );
});
afterAll(() => {
  vi.unstubAllGlobals();
});

test("Instantiate WebGLRenderer", () => {
  document.body.innerHTML = '<canvas id="canvas"></canvas>';
  const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
  const renderer = new WebGLRenderer(canvas);
  expect(renderer).toBeDefined();
});

test("Instantiate WebGLRenderer with no WebGL context", () => {
  document.body.innerHTML = '<canvas id="canvas"></canvas>';
  const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
  canvas.getContext = () => null;
  expect(() => new WebGLRenderer(canvas)).toThrowError();
});
