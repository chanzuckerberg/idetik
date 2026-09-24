import { expect, test } from "vitest";

import { sortSplatsBackToFront } from "@/utilities/splat_sort";

test("orders splats from most negative view z to least", () => {
  // Camera looking down -z: view z = world z - 10.
  const centers = new Float32Array([0, 0, 5, 0, 0, -3, 0, 0, 1, 0, 0, 2]);
  const order = sortSplatsBackToFront(
    centers,
    [0, 0, 1, -10],
    new Uint32Array(4)
  );
  expect(Array.from(order)).toEqual([1, 2, 3, 0]);
});

test("handles coincident depths and padded output", () => {
  const centers = new Float32Array([1, 0, 0, 1, 0, 0]);
  const order = sortSplatsBackToFront(
    centers,
    [0, 0, 1, 0],
    new Uint32Array(4)
  );
  expect(Array.from(order.subarray(0, 2)).sort()).toEqual([0, 1]);
});
