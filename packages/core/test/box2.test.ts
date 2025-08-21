import { expect, test } from "vitest";
import { vec2 } from "gl-matrix";

import { Box2 } from "@";

test("default constructor yields an empty box", () => {
  const b = new Box2();
  expect(b.isEmpty()).toBe(true);
});

test("non-empty when min <= max on both axes", () => {
  const b = new Box2(vec2.fromValues(0, 0), vec2.fromValues(1, 1));
  expect(b.isEmpty()).toBe(false);
});

test("isEmpty detects inverted bounds", () => {
  const b = new Box2(vec2.fromValues(1, 1), vec2.fromValues(0, 0));
  expect(b.isEmpty()).toBe(true);
});

test("intersects: overlapping boxes return true", () => {
  const a = new Box2(vec2.fromValues(0, 0), vec2.fromValues(2, 2));
  const b = new Box2(vec2.fromValues(1, 1), vec2.fromValues(3, 3));
  expect(Box2.intersects(a, b)).toBe(true);
  expect(Box2.intersects(b, a)).toBe(true); // symmetry
});

test("intersects: separated boxes return false", () => {
  const a = new Box2(vec2.fromValues(0, 0), vec2.fromValues(1, 1));
  const b = new Box2(vec2.fromValues(2, 2), vec2.fromValues(3, 3));
  expect(Box2.intersects(a, b)).toBe(false);
  expect(Box2.intersects(b, a)).toBe(false); // symmetry
});

test("intersects: touching edges do not count as intersecting", () => {
  const a = new Box2(vec2.fromValues(0, 0), vec2.fromValues(2, 2));
  const b = new Box2(vec2.fromValues(2, 0), vec2.fromValues(4, 2));
  const c = new Box2(vec2.fromValues(0, 2), vec2.fromValues(2, 4));
  expect(Box2.intersects(a, b)).toBe(false);
  expect(Box2.intersects(a, c)).toBe(false);
});

test("intersects: empty and non-empty box do not intersect", () => {
  const a = new Box2(); // empty
  const b = new Box2(vec2.fromValues(0, 0), vec2.fromValues(1, 1));
  expect(a.isEmpty()).toBe(true);
  expect(b.isEmpty()).toBe(false);
  expect(Box2.intersects(a, b)).toBe(false);
});

test("clone creates a deep copy", () => {
  const a = new Box2(vec2.fromValues(0, 0), vec2.fromValues(1, 1));
  const b = a.clone();

  a.min[0] = 10;
  a.max[1] = 20;

  expect(b.min[0]).toBe(0);
  expect(b.max[1]).toBe(1);
  expect(a.min[0]).not.toBe(b.min[0]);
  expect(a.max[1]).not.toBe(b.max[1]);
});

test("equals: identical boxes return true", () => {
  const a = new Box2(vec2.fromValues(10, 20), vec2.fromValues(110, 220));
  const b = new Box2(vec2.fromValues(10, 20), vec2.fromValues(110, 220));
  expect(Box2.equals(a, b)).toBe(true);
});

test("equals: different boxes return false", () => {
  const a = new Box2(vec2.fromValues(10, 20), vec2.fromValues(110, 220));
  const b = new Box2(vec2.fromValues(15, 25), vec2.fromValues(115, 225));
  expect(Box2.equals(a, b)).toBe(false);
});

test("equals: handles small epsilon differences", () => {
  const a = new Box2(
    vec2.fromValues(10.0000001, 20.0000001),
    vec2.fromValues(110.0000001, 220.0000001)
  );
  const b = new Box2(vec2.fromValues(10, 20), vec2.fromValues(110, 220));
  expect(Box2.equals(a, b)).toBe(true);
});

test("equals: custom absolute tolerance", () => {
  const a = new Box2(vec2.fromValues(10, 20), vec2.fromValues(110, 220));
  const b = new Box2(
    vec2.fromValues(10.1, 20.1),
    vec2.fromValues(110.1, 220.1)
  );
  expect(Box2.equals(a, b, { absoluteTolerance: 0.2 })).toBe(true);
  expect(Box2.equals(a, b, { absoluteTolerance: 0.05 })).toBe(false);
});

test("equals: relative tolerance for large values", () => {
  const a = new Box2(
    vec2.fromValues(1000, 2000),
    vec2.fromValues(11000, 22000)
  );
  const b = new Box2(
    vec2.fromValues(1000.1, 2000.1),
    vec2.fromValues(11000.1, 22000.1)
  );
  // 0.1 difference on large values should pass with relative tolerance
  expect(Box2.equals(a, b, { relativeTolerance: 1e-4 })).toBe(true);
  expect(Box2.equals(a, b, { relativeTolerance: 1e-6 })).toBe(false);
});

test("equals: integer coordinates use default tolerance", () => {
  const a = new Box2(vec2.fromValues(10, 20), vec2.fromValues(110, 220));
  const b = new Box2(vec2.fromValues(10, 20), vec2.fromValues(110, 220));
  // Integer coordinates should be exactly equal
  expect(Box2.equals(a, b)).toBe(true);
});

test("equals: identical values work with zero tolerance", () => {
  const a = new Box2(vec2.fromValues(10, 20), vec2.fromValues(110, 220));
  const b = new Box2(vec2.fromValues(10, 20), vec2.fromValues(110, 220));
  // Should work even with zero tolerance since values are identical
  expect(
    Box2.equals(a, b, { absoluteTolerance: 0, relativeTolerance: 0 })
  ).toBe(true);
});
