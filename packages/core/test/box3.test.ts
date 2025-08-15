import { expect, test } from "vitest";
import { vec3 } from "gl-matrix";

import { Box3 } from "@";

test("default constructor yields an empty box", () => {
  const b = new Box3();
  expect(b.isEmpty()).toBe(true);
});

test("non-empty when min <= max on all axes", () => {
  const b = new Box3(vec3.fromValues(0, 0, 0), vec3.fromValues(1, 1, 1));
  expect(b.isEmpty()).toBe(false);
});

test("isEmpty detects inverted bounds", () => {
  const invX = new Box3(vec3.fromValues(1, 0, 0), vec3.fromValues(0, 1, 1));
  const invY = new Box3(vec3.fromValues(0, 1, 0), vec3.fromValues(1, 0, 1));
  const invZ = new Box3(vec3.fromValues(0, 0, 1), vec3.fromValues(1, 1, 0));
  expect(invX.isEmpty()).toBe(true);
  expect(invY.isEmpty()).toBe(true);
  expect(invZ.isEmpty()).toBe(true);
});

test("intersects: overlapping boxes return true", () => {
  const a = new Box3(vec3.fromValues(0, 0, 0), vec3.fromValues(2, 2, 2));
  const b = new Box3(vec3.fromValues(1, 1, 1), vec3.fromValues(3, 3, 3));
  expect(Box3.intersects(a, b)).toBe(true);
  expect(Box3.intersects(b, a)).toBe(true); // symmetry
});

test("intersects: separated boxes return false", () => {
  const a = new Box3(vec3.fromValues(0, 0, 0), vec3.fromValues(1, 1, 1));
  const b = new Box3(vec3.fromValues(2, 2, 2), vec3.fromValues(3, 3, 3));
  expect(Box3.intersects(a, b)).toBe(false);
  expect(Box3.intersects(b, a)).toBe(false); // symmetry
});

test("intersects: touching edges do not count as intersecting", () => {
  const a = new Box3(vec3.fromValues(0, 0, 0), vec3.fromValues(2, 2, 2));
  const b = new Box3(vec3.fromValues(2, 0, 0), vec3.fromValues(4, 2, 2));
  const c = new Box3(vec3.fromValues(2, 2, 0), vec3.fromValues(4, 4, 2));
  const d = new Box3(vec3.fromValues(2, 2, 2), vec3.fromValues(4, 4, 4));
  expect(Box3.intersects(a, b)).toBe(false);
  expect(Box3.intersects(a, c)).toBe(false);
  expect(Box3.intersects(a, d)).toBe(false);
});

test("intersects: empty and non-empty box do not intersect", () => {
  const a = new Box3(); // empty
  const b = new Box3(vec3.fromValues(0, 0, 0), vec3.fromValues(1, 1, 1));
  expect(a.isEmpty()).toBe(true);
  expect(b.isEmpty()).toBe(false);
  expect(Box3.intersects(a, b)).toBe(false);
});

test("clone creates a deep copy", () => {
  const a = new Box3(vec3.fromValues(0, 0, 0), vec3.fromValues(1, 1, 1));
  const b = a.clone();

  a.min[0] = 10;
  a.max[2] = 20;

  expect(b.min[0]).toBe(0);
  expect(b.max[2]).toBe(1);
  expect(a.min[0]).not.toBe(b.min[0]);
  expect(a.max[2]).not.toBe(b.max[2]);
});
