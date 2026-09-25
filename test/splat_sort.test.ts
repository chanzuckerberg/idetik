import { expect, test } from "vitest";

import { sortSplatsBackToFront } from "@/objects/renderable/gaussian_splat_renderable";

function sort(positions: number[], stride: number, viewZ: number[]) {
  const count = positions.length / stride;
  const out = new Uint32Array(count);
  sortSplatsBackToFront(
    new Float32Array(positions),
    stride,
    viewZ,
    out,
    new Float32Array(count)
  );
  return Array.from(out);
}

test("orders splats from most negative view z to least", () => {
  // Camera looking down -z: view z = world z - 10.
  const positions = [0, 0, 5, 0, 0, -3, 0, 0, 1, 0, 0, 2];
  expect(sort(positions, 3, [0, 0, 1, -10])).toEqual([1, 2, 3, 0]);
});

test("reads positions with a stride", () => {
  const positions = [0, 0, 5, 9, 0, 0, -3, 9];
  expect(sort(positions, 4, [0, 0, 1, 0])).toEqual([1, 0]);
});

test("handles coincident depths", () => {
  expect(sort([1, 0, 0, 1, 0, 0], 3, [0, 0, 1, 0]).sort()).toEqual([0, 1]);
});
