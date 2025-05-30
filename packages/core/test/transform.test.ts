import { mat4, vec3, quat } from "gl-matrix";

import { expect, test, vi } from "vitest";

import { TrsTransform } from "@/core/transforms";

// NOTES:
// * mat4 is column-major
// * use mat4.equals instead of expect(t.matrix).toEqual because it's better for comparing floats,
// even though it provides worse output on failure

const expectMatrixEquals = (a: mat4, b: mat4) => {
  try {
    expect(mat4.equals(a, b)).toBe(true);
  } catch (error) {
    console.error("Expected matrices to be equal, but they are not:");
    console.error("Matrix A:", a);
    console.error("Matrix B:", b);
    throw error;
  }
};

const expectMatrixNotEquals = (a: mat4, b: mat4) => {
  try {
    expect(mat4.equals(a, b)).toBe(false);
  } catch (error) {
    console.error("Expected matrices to be *not* equal:");
    console.error("Matrix A:", a);
    console.error("Matrix B:", b);
    throw error;
  }
};

test("rotate", () => {
  const t = new TrsTransform();
  const q = quat.rotateZ(quat.create(), quat.create(), Math.PI / 2);
  t.addRotation(q);
  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [0, 1, 0, 0,
      -1, 0, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1]
  );
  t.addRotation(quat.invert(quat.create(), q));
  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1]
  );
});

test("translate", () => {
  const t = new TrsTransform();
  const t0 = vec3.fromValues(1, 2, 3);
  t.addTranslation(t0);
  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      1, 2, 3, 1]
  );
  t.addTranslation(t0);
  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      2, 4, 6, 1]
  );
});

test("scale", () => {
  const t = new TrsTransform();
  t.addScale(vec3.fromValues(2, 3, 4));
  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [2, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 4, 0,
      0, 0, 0, 1]
  );
  t.addScale(vec3.fromValues(2, 3, 4));
  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [4, 0, 0, 0,
      0, 9, 0, 0,
      0, 0, 16, 0,
      0, 0, 0, 1]
  );
});

test("scale then translate", () => {
  const t = new TrsTransform();
  t.addScale(vec3.fromValues(2, 3, 4));
  t.addTranslation(vec3.fromValues(1, 2, 3));
  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [2, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 4, 0,
      1, 2, 3, 1]
  );
});

test("translate then scale", () => {
  const t = new TrsTransform();
  t.addTranslation(vec3.fromValues(1, 2, 3));
  t.addScale(vec3.fromValues(2, 3, 4));
  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [2, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 4, 0,
      1, 2, 3, 1]
  );
});

test("rotate then translate", () => {
  const t = new TrsTransform();
  const q = quat.rotateZ(quat.create(), quat.create(), Math.PI / 2);
  t.addRotation(q);
  t.addTranslation(vec3.fromValues(1, 2, 3));
  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [0, 1, 0, 0,
      -1, 0, 0, 0,
      0, 0, 1, 0,
      1, 2, 3, 1]
  );
});

test("translate then rotate", () => {
  const t = new TrsTransform();
  t.addTranslation(vec3.fromValues(1, 2, 3));
  const q = quat.rotateZ(quat.create(), quat.create(), Math.PI / 2);
  t.addRotation(q);
  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [0, 1, 0, 0,
      -1, 0, 0, 0,
      0, 0, 1, 0,
      1, 2, 3, 1]
  );
});

test("inverse", () => {
  // use two transforms to check inverse is correct without first accessing the matrix
  const t0 = new TrsTransform();
  const t1 = new TrsTransform();
  const rotation = quat.rotateZ(quat.create(), quat.create(), Math.PI / 2);
  const translation = vec3.fromValues(1, 2, 3);
  const scale = vec3.fromValues(2, 3, 4);
  t0.addRotation(rotation);
  t0.addTranslation(translation);
  t0.addScale(scale);
  t1.addRotation(rotation);
  t1.addTranslation(translation);
  t1.addScale(scale);
  expectMatrixEquals(t0.inverse, mat4.invert(mat4.create(), t1.matrix));
});

test("matrix is cached on repeat access", () => {
  const t = new TrsTransform();
  // @ts-expect-error TS2345 - spying on private method
  const computeSpy = vi.spyOn(t, "computeMatrix");
  t.addTranslation(vec3.fromValues(1, 2, 3));
  expect(t.matrix).toBe(t.matrix);
  expect(computeSpy).toHaveBeenCalledTimes(1);
});

test("setRotation replaces existing rotation", () => {
  const t = new TrsTransform();
  const q1 = quat.rotateX(quat.create(), quat.create(), Math.PI / 4);
  const q2 = quat.rotateY(quat.create(), quat.create(), Math.PI / 2);

  t.setRotation(q1);
  const matrix1 = mat4.clone(t.matrix);

  t.setRotation(q2);
  const matrix2 = mat4.clone(t.matrix);

  expectMatrixNotEquals(matrix1, matrix2);

  // prettier-ignore
  expectMatrixEquals(
    matrix2,
    [0, 0, -1, 0,
      0, 1, 0, 0,
      1, 0, 0, 0,
      0, 0, 0, 1]
  );
});

test("setTranslation replaces existing translation", () => {
  const t = new TrsTransform();

  t.setTranslation(vec3.fromValues(1, 2, 3));
  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      1, 2, 3, 1]
  );

  t.setTranslation(vec3.fromValues(4, 5, 6));
  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      4, 5, 6, 1]
  );
});

test("setScale replaces existing scale", () => {
  const t = new TrsTransform();

  t.setScale(vec3.fromValues(2, 3, 4));
  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [2, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 4, 0,
      0, 0, 0, 1]
  );

  t.setScale(vec3.fromValues(5, 6, 7));
  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [5, 0, 0, 0,
      0, 6, 0, 0,
      0, 0, 7, 0,
      0, 0, 0, 1]
  );
});

test("getters return independent copies", () => {
  const t = new TrsTransform();
  const originalRotation = quat.rotateX(
    quat.create(),
    quat.create(),
    Math.PI / 4
  );
  const originalTranslation = vec3.fromValues(1, 2, 3);
  const originalScale = vec3.fromValues(2, 3, 4);

  t.setRotation(originalRotation);
  t.setTranslation(originalTranslation);
  t.setScale(originalScale);

  const gotRotation = t.rotation;
  const gotTranslation = t.translation;
  const gotScale = t.scale;

  expect(quat.equals(gotRotation, originalRotation)).toBe(true);
  expect(vec3.equals(gotTranslation, originalTranslation)).toBe(true);
  expect(vec3.equals(gotScale, originalScale)).toBe(true);

  quat.rotateY(gotRotation, gotRotation, Math.PI);
  vec3.add(gotTranslation, gotTranslation, vec3.fromValues(10, 10, 10));
  vec3.multiply(gotScale, gotScale, vec3.fromValues(2, 2, 2));

  expect(quat.equals(t.rotation, originalRotation)).toBe(true);
  expect(vec3.equals(t.translation, originalTranslation)).toBe(true);
  expect(vec3.equals(t.scale, originalScale)).toBe(true);
});

test("default transform is identity", () => {
  const t = new TrsTransform();

  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1]
  );

  expect(quat.equals(t.rotation, quat.create())).toBe(true);
  expect(vec3.equals(t.translation, vec3.create())).toBe(true);
  expect(vec3.equals(t.scale, vec3.fromValues(1, 1, 1))).toBe(true);
});

test("zero scale", () => {
  const t = new TrsTransform();
  t.setScale(vec3.fromValues(0, 0, 0));

  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 1]
  );
});

test("partial zero scale", () => {
  const t = new TrsTransform();
  t.setScale(vec3.fromValues(2, 0, 3));

  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [2, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 3, 0,
      0, 0, 0, 1]
  );
});

test("multiple axis rotations combine", () => {
  const t = new TrsTransform();

  const rotX = quat.rotateX(quat.create(), quat.create(), Math.PI / 2);
  const rotY = quat.rotateY(quat.create(), quat.create(), Math.PI / 2);
  const rotZ = quat.rotateZ(quat.create(), quat.create(), Math.PI / 2);

  t.addRotation(rotX);
  t.addRotation(rotY);
  t.addRotation(rotZ);

  const combined = mat4.clone(t.matrix);
  expectMatrixEquals(
    combined,
    // prettier-ignore
    [0, 0, 1, 0,
      0, -1, 0, 0,
      1, 0, 0, 0,
      0, 0, 0, 1]
  );

  const tX = new TrsTransform();
  tX.addRotation(rotX);

  expectMatrixNotEquals(combined, tX.matrix);
});

test("scale rotation translation order", () => {
  const t = new TrsTransform();

  t.addScale(vec3.fromValues(2, 3, 4));
  t.addRotation(quat.rotateZ(quat.create(), quat.create(), Math.PI / 2));
  t.addTranslation(vec3.fromValues(5, 6, 7));

  // prettier-ignore
  expectMatrixEquals(
    t.matrix,
    [0, 2, 0, 0,
    -3, 0, 0, 0,
     0, 0, 4, 0,
     5, 6, 7, 1]
  );
});

test("inverse produces identity when multiplied", () => {
  const t = new TrsTransform();

  t.addScale(vec3.fromValues(2, 3, 4));
  t.addRotation(quat.rotateZ(quat.create(), quat.create(), Math.PI / 4));
  t.addTranslation(vec3.fromValues(1, 2, 3));

  const forward = mat4.clone(t.matrix);
  const inverse = mat4.clone(t.inverse);

  const product = mat4.multiply(mat4.create(), forward, inverse);
  // prettier-ignore
  expectMatrixEquals(
    product,
    [1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1]
  );
});
