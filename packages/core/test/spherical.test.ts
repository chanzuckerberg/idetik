import { expect, test } from "vitest";
import { glMatrix, vec3 } from "gl-matrix";

import { Spherical } from "@";

const PI = Math.PI;
const PI_OVER_2 = PI / 2;
const PI_OVER_4 = PI / 4;

function expectVec3Close(v: vec3, [x, y, z]: [number, number, number]) {
  expect(v[0]).toBeCloseTo(x);
  expect(v[1]).toBeCloseTo(y);
  expect(v[2]).toBeCloseTo(z);
}

test("makeSafe clamps when theta > +π/2", () => {
  const phi = glMatrix.toRadian(30);
  const theta = PI_OVER_2 + Number.EPSILON;
  const s = new Spherical(2, phi, theta);

  s.makeSafe();
  const expected = PI_OVER_2 - Number.EPSILON;

  expect(s.phi).toBe(glMatrix.toRadian(30));
  expect(s.theta).toBeCloseTo(expected);
  expect(s.radius).toBe(2);
});

test("makeSafe clamps when theta < -π/2", () => {
  const phi = glMatrix.toRadian(30);
  const theta = -PI_OVER_2 - Number.EPSILON;
  const s = new Spherical(2, phi, theta);

  s.makeSafe();
  const expected = -PI_OVER_2 + Number.EPSILON;

  expect(s.phi).toBeCloseTo(glMatrix.toRadian(30));
  expect(s.theta).toBeCloseTo(expected);
  expect(s.radius).toBeCloseTo(2);
});

test("makeSafe leaves theta unchanged when already in range", () => {
  const phi = glMatrix.toRadian(30);
  const theta = glMatrix.toRadian(30);
  const s = new Spherical(2, phi, theta);

  s.makeSafe();

  expect(s.phi).toBe(glMatrix.toRadian(30));
  expect(s.theta).toBe(glMatrix.toRadian(30));
  expect(s.radius).toBe(2);
});

test("toVec3 basic", () => {
  const phi = PI_OVER_4;
  const theta = PI_OVER_4;
  const s = new Spherical(1, phi, theta);
  const v = s.toVec3();

  const expect_x = Math.sin(phi) * Math.cos(theta);
  const expect_y = -Math.sin(theta);
  const expect_z = Math.cos(phi) * Math.cos(theta);

  expectVec3Close(v, [expect_x, expect_y, expect_z]);
});

test("toVec3 south pole, θ = +π/2 ignores phi", () => {
  const phi = PI_OVER_4;
  const theta = PI_OVER_2;
  const s = new Spherical(3, phi, theta);
  const v = s.toVec3();

  expectVec3Close(v, [0, -3, 0]);
});

test("toVec3 equator, phi = π/2 → +X", () => {
  const phi = PI_OVER_2;
  const theta = 0;
  const s = new Spherical(3, phi, theta);
  const v = s.toVec3();

  expectVec3Close(v, [3, 0, 0]);
});

test("toVec3 equator, phi = 0 → +Z", () => {
  const phi = 0;
  const theta = 0;
  const s = new Spherical(3, phi, theta);
  const v = s.toVec3();

  expectVec3Close(v, [0, 0, 3]);
});
