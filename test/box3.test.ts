import { expect, test } from "vitest";
import { mat4, vec3 } from "gl-matrix";

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

test("expand with points", () => {
  const b = new Box3(vec3.fromValues(0, 0, 0), vec3.fromValues(1, 1, 1));

  b.expandWithPoint(vec3.fromValues(1, 2, -2));
  b.expandWithPoint(vec3.fromValues(3, -4, 1));
  b.expandWithPoint(vec3.fromValues(-2, 5, 0));
  b.expandWithPoint(vec3.fromValues(0.5, 0.5, 0.5));
  b.expandWithPoint(vec3.fromValues(3, 2, 1));
  b.expandWithPoint(vec3.fromValues(-2, -4, -3));

  expect(b.min).toEqual(vec3.fromValues(-2, -4, -3));
  expect(b.max).toEqual(vec3.fromValues(3, 5, 1));
});

test("expand with points no-op when point lies inside (including boundary)", () => {
  const b = new Box3(vec3.fromValues(-1, -1, -1), vec3.fromValues(1, 1, 1));
  const beforeMin = vec3.clone(b.min);
  const beforeMax = vec3.clone(b.max);

  b.expandWithPoint(vec3.fromValues(0.25, -0.5, 0.9));
  b.expandWithPoint(vec3.fromValues(1, 0, 0));
  b.expandWithPoint(vec3.fromValues(-1, -1, -1));
  b.expandWithPoint(vec3.fromValues(1, 1, 1));

  expect(b.min).toEqual(beforeMin);
  expect(b.max).toEqual(beforeMax);
});

test("apply transform identity leaves box unchanged", () => {
  const b = new Box3(vec3.fromValues(0, 0, 0), vec3.fromValues(1, 1, 1));
  const m = mat4.create();
  b.applyTransform(m);

  expect(b.min).toEqual(vec3.fromValues(0, 0, 0));
  expect(b.max).toEqual(vec3.fromValues(1, 1, 1));
});

test("apply transform with translation shifts box by offset", () => {
  const b = new Box3(vec3.fromValues(-1, 2, 3), vec3.fromValues(4, 5, 6));
  const m = mat4.fromTranslation(mat4.create(), vec3.fromValues(10, -2, 7));
  b.applyTransform(m);

  expect(b.min).toEqual(vec3.fromValues(9, 0, 10));
  expect(b.max).toEqual(vec3.fromValues(14, 3, 13));
});

test("apply transform rotation 90° around Z", () => {
  const b = new Box3(vec3.fromValues(0, 0, 0), vec3.fromValues(1, 1, 1));
  const m = mat4.fromZRotation(mat4.create(), Math.PI / 2);
  b.applyTransform(m);

  const expectedMin = vec3.fromValues(-1, 0, 0);
  const expectedMax = vec3.fromValues(0, 1, 1);

  for (let i = 0; i < 3; i++) {
    expect(b.min[i]).toBeCloseTo(expectedMin[i]);
    expect(b.max[i]).toBeCloseTo(expectedMax[i]);
  }
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
