import { expect, test } from "vitest";
import { mat4, vec3 } from "gl-matrix";

import { Box3, Frustum } from "@";

test("identity frustum with box fully inside", () => {
  const vp = mat4.create();
  const frustum = new Frustum(vp);

  const b = new Box3(
    vec3.fromValues(-0.25, -0.25, -0.25),
    vec3.fromValues(0.25, 0.25, 0.25)
  );
  expect(frustum.intersectsWithBox3(b)).toBe(true);
});

test("identity frustum with box fully outside on +X", () => {
  const vp = mat4.create();
  const frustum = new Frustum(vp);

  const b = new Box3(
    vec3.fromValues(1.25, -0.25, -0.25),
    vec3.fromValues(1.75, 0.25, 0.25)
  );
  expect(frustum.intersectsWithBox3(b)).toBe(false);
});

test("identity frustum with box touching +X plane counts as intersecting", () => {
  const vp = mat4.create();
  const frustum = new Frustum(vp);

  const b = new Box3(
    vec3.fromValues(0.5, -0.2, -0.2),
    vec3.fromValues(1.0, 0.2, 0.2)
  );
  expect(frustum.intersectsWithBox3(b)).toBe(true);
});

test("orthographic frustum with inside box", () => {
  const vp = mat4.ortho(mat4.create(), -1, 1, -1, 1, 1, 10);
  const frustum = new Frustum(vp);

  const b = new Box3(
    vec3.fromValues(-0.25, -0.25, -3.25),
    vec3.fromValues(0.25, 0.25, -2.75)
  );
  expect(frustum.intersectsWithBox3(b)).toBe(true);
});

test("orthographic frustum rejects box fully outside on -X", () => {
  const vp = mat4.ortho(mat4.create(), -1, 1, -1, 1, 1, 10);
  const frustum = new Frustum(vp);

  const b = new Box3(
    vec3.fromValues(-2.25, -0.25, -3.25),
    vec3.fromValues(-1.75, 0.25, -2.75)
  );
  expect(frustum.intersectsWithBox3(b)).toBe(false);
});

test("orthographic frustum rejects box in front of near plane", () => {
  const vp = mat4.ortho(mat4.create(), -1, 1, -1, 1, 1, 10);
  const frustum = new Frustum(vp);

  const b = new Box3(
    vec3.fromValues(-0.1, -0.1, -0.6),
    vec3.fromValues(0.1, 0.1, -0.4)
  );
  expect(frustum.intersectsWithBox3(b)).toBe(false);
});

test("orthographic frustum rejects box beyond far plane", () => {
  const vp = mat4.ortho(mat4.create(), -1, 1, -1, 1, 1, 10);
  const frustum = new Frustum(vp);

  const b = new Box3(
    vec3.fromValues(-0.25, -0.25, -11.25),
    vec3.fromValues(0.25, 0.25, -10.75)
  );
  expect(frustum.intersectsWithBox3(b)).toBe(false);
});

test("perspective frustum with small box at z = -3 inside", () => {
  const proj = mat4.perspective(mat4.create(), Math.PI / 2, 1, 1, 10);
  const frustum = new Frustum(proj);

  const b = new Box3(
    vec3.fromValues(-0.2, -0.2, -3.2),
    vec3.fromValues(0.2, 0.2, -2.8)
  );
  expect(frustum.intersectsWithBox3(b)).toBe(true);
});

test("perspective frustum rejects far left box at z = -3", () => {
  const proj = mat4.perspective(mat4.create(), Math.PI / 2, 1, 1, 10);
  const frustum = new Frustum(proj);

  const b = new Box3(
    vec3.fromValues(-4.25, -0.25, -3.25),
    vec3.fromValues(-3.75, 0.25, -2.75)
  );
  expect(frustum.intersectsWithBox3(b)).toBe(false);
});

test("perspective frustum rejects boxes in front of near and beyond far", () => {
  const proj = mat4.perspective(mat4.create(), Math.PI / 2, 1, 1, 10);
  const frustum = new Frustum(proj);

  const tooNear = new Box3(
    vec3.fromValues(-0.1, -0.1, -0.6),
    vec3.fromValues(0.1, 0.1, -0.4)
  );
  const tooFar = new Box3(
    vec3.fromValues(-0.5, -0.5, -11.5),
    vec3.fromValues(0.5, 0.5, -10.5)
  );

  expect(frustum.intersectsWithBox3(tooNear)).toBe(false);
  expect(frustum.intersectsWithBox3(tooFar)).toBe(false);
});

test("perspective frustum with box touching side plane counts as intersecting", () => {
  const proj = mat4.perspective(mat4.create(), Math.PI / 2, 1, 1, 10);
  const frustum = new Frustum(proj);

  const b = new Box3(
    vec3.fromValues(1.5, -0.2, -2.2),
    vec3.fromValues(2.0, 0.2, -1.8)
  );
  expect(frustum.intersectsWithBox3(b)).toBe(true);
});
