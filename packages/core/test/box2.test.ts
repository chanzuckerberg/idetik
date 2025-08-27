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

test("toRect: converts box to rectangle format", () => {
  const box = new Box2(vec2.fromValues(10, 20), vec2.fromValues(110, 220));
  const result = box.toRect();

  expect(result).toEqual({
    x: 10,
    y: 20,
    width: 100,
    height: 200,
  });
});

test("toRect: preserves floating point values", () => {
  const box = new Box2(
    vec2.fromValues(10.7, 20.9),
    vec2.fromValues(110.3, 220.1)
  );
  const result = box.toRect();

  expect(result.x).toBeCloseTo(10.7);
  expect(result.y).toBeCloseTo(20.9);
  expect(result.width).toBeCloseTo(99.6);
  expect(result.height).toBeCloseTo(199.2);
});

test("clamp: floors coordinates to integers", () => {
  const box = new Box2(
    vec2.fromValues(10.7, 20.9),
    vec2.fromValues(110.3, 220.1)
  );
  const clamped = box.floor();

  expect(clamped.min).toEqual(vec2.fromValues(10, 20));
  expect(clamped.max).toEqual(vec2.fromValues(110, 220));
});

test("equals: compares boxes for exact equality", () => {
  const a = new Box2(vec2.fromValues(10, 20), vec2.fromValues(110, 220));
  const b = new Box2(vec2.fromValues(10, 20), vec2.fromValues(110, 220));
  const c = new Box2(vec2.fromValues(15, 25), vec2.fromValues(115, 225));

  expect(Box2.equals(a, b)).toBe(true);
  expect(Box2.equals(a, c)).toBe(false);
});
