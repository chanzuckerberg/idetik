import { expect, test } from "vitest";
import { vec3 } from "gl-matrix";

import { Plane } from "@/math/plane";

test("constructed with default values", () => {
  const plane = new Plane();

  expect(plane.normal).toEqual(vec3.fromValues(0, 1, 0));
  expect(plane.signedDistance).toEqual(0);
});

test("distance to point returns correct sign relative to plane", () => {
  const plane = new Plane(vec3.fromValues(0, 1, 0), 1);

  expect(plane.signedDistanceToPoint(vec3.fromValues(0, -1, 0))).toBe(0);
  expect(plane.signedDistanceToPoint(vec3.fromValues(0, -2, 0))).toBeLessThan(
    0
  );
  expect(plane.signedDistanceToPoint(vec3.fromValues(0, 0, 0))).toBeGreaterThan(
    0
  );
});

test("arbitrary normal and distance yields correct distance magnitude", () => {
  const plane = new Plane(vec3.fromValues(1, 1, 1), 3);

  expect(plane.signedDistanceToPoint(vec3.fromValues(-1, -1, -1))).toBe(0);
  expect(plane.signedDistanceToPoint(vec3.fromValues(0, 0, 0))).toBe(3);
  expect(plane.signedDistanceToPoint(vec3.fromValues(-2, -2, -2))).toBe(-3);
});

test("normalize scales normal to unit length and adjusts distance", () => {
  const plane = new Plane(vec3.fromValues(0, 2, 0), 2);
  plane.normalize();

  expect(vec3.length(plane.normal)).toBeCloseTo(1);
  expect(plane.signedDistance).toBeCloseTo(1);
});

test("normalize handles zero-length normal safely", () => {
  const plane = new Plane(vec3.fromValues(0, 0, 0), 5);
  plane.normalize();

  expect(plane.normal).toEqual(vec3.fromValues(0, 0, 0));
  expect(plane.signedDistance).toBe(5);
});

test("plane with inverted normal flips distance sign", () => {
  const planePositiveY = new Plane(vec3.fromValues(0, 1, 0), 1);
  const planeNegativeY = new Plane(vec3.fromValues(0, -1, 0), -1);
  const point = vec3.fromValues(0, 2, 0);

  expect(planePositiveY.signedDistanceToPoint(point)).toBe(3);
  expect(planeNegativeY.signedDistanceToPoint(point)).toBe(-3);
});

test("fromPointAndNormal constructs a plane containing the point", () => {
  const plane = Plane.fromPointAndNormal(
    vec3.fromValues(10, 20, 300),
    vec3.fromValues(0, 0, 1)
  );

  expect(plane.signedDistanceToPoint(vec3.fromValues(10, 20, 300))).toBe(0);
  expect(plane.signedDistanceToPoint(vec3.fromValues(-5, 7, 300))).toBe(0);
});

test("fromPointAndNormal handles non-axis-aligned normals", () => {
  const normal = vec3.normalize(vec3.create(), vec3.fromValues(1, 1, 1));
  const point = vec3.fromValues(2, 2, 2);
  const plane = Plane.fromPointAndNormal(point, normal);

  expect(plane.signedDistanceToPoint(point)).toBeCloseTo(0);

  const above = vec3.scaleAndAdd(vec3.create(), point, normal, 1);

  expect(plane.signedDistanceToPoint(above)).toBeCloseTo(1);
});
