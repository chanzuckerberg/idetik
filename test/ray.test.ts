import { expect, test } from "vitest";
import { vec3 } from "gl-matrix";

import { Plane } from "@/math/plane";
import { Ray } from "@/math/ray";

test("intersectWithPlane intersects a plane straight on", () => {
  const ray = new Ray(vec3.fromValues(100, 50, 1e6), vec3.fromValues(0, 0, -1));
  const plane = Plane.fromPointAndNormal(
    vec3.fromValues(0, 0, 300),
    vec3.fromValues(0, 0, 1)
  );

  const hit = ray.intersectWithPlane(plane)!;

  expect(hit).not.toBeNull();
  expect(hit[0]).toBeCloseTo(100);
  expect(hit[1]).toBeCloseTo(50);
  expect(hit[2]).toBeCloseTo(300);
});

test("intersectWithPlane intersects a plane at an oblique angle", () => {
  const ray = new Ray(vec3.fromValues(0, 0, 10), vec3.fromValues(1, 0, -1));
  const plane = Plane.fromPointAndNormal(
    vec3.fromValues(0, 0, 0),
    vec3.fromValues(0, 0, 1)
  );

  const hit = ray.intersectWithPlane(plane)!;

  expect(hit).not.toBeNull();
  expect(hit[0]).toBeCloseTo(10);
  expect(hit[1]).toBeCloseTo(0);
  expect(hit[2]).toBeCloseTo(0);
});

test("intersectWithPlane returns null for a ray parallel to the plane", () => {
  const ray = new Ray(vec3.fromValues(0, 0, 10), vec3.fromValues(1, 0, 0));
  const plane = Plane.fromPointAndNormal(
    vec3.fromValues(0, 0, 0),
    vec3.fromValues(0, 0, 1)
  );

  expect(ray.intersectWithPlane(plane)).toBeNull();
});
