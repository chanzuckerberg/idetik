import { beforeAll, expect, test, vi } from "vitest";

import { WebGLRenderer } from "@";

beforeAll(() => {
  vi.useFakeTimers();
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
