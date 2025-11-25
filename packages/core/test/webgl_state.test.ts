import { expect, test } from "vitest";
import { vec2 } from "gl-matrix";
import { WebGLState } from "../src/renderers/WebGLState";
import { Box2 } from "../src/math/box2";

function createTestWebGLContext(): WebGL2RenderingContext {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    throw new Error("WebGL2 not supported in test environment");
  }
  return gl;
}

test("setViewport sets correct viewport parameters", () => {
  const gl = createTestWebGLContext();
  const webglState = new WebGLState(gl);

  const viewport = new Box2({
    min: vec2.fromValues(10, 20),
    max: vec2.fromValues(110, 220),
  });

  webglState.setViewport(viewport);

  const actualViewport = gl.getParameter(gl.VIEWPORT);
  expect(Array.from(actualViewport)).toEqual([10, 20, 100, 200]);
});

test("setViewport with floating point values floors to integers", () => {
  const gl = createTestWebGLContext();
  const webglState = new WebGLState(gl);

  const viewport = new Box2({
    min: vec2.fromValues(10.7, 20.9),
    max: vec2.fromValues(110.3, 220.1),
  });

  webglState.setViewport(viewport);

  const actualViewport = gl.getParameter(gl.VIEWPORT);
  expect(Array.from(actualViewport)).toEqual([10, 20, 100, 200]);
});

test("setScissorTest enables and disables scissor test", () => {
  const gl = createTestWebGLContext();
  const webglState = new WebGLState(gl);

  webglState.setScissorTest(true);
  expect(gl.isEnabled(gl.SCISSOR_TEST)).toBe(true);

  webglState.setScissorTest(false);
  expect(gl.isEnabled(gl.SCISSOR_TEST)).toBe(false);
});

test("setScissor sets scissor region", () => {
  const gl = createTestWebGLContext();
  const webglState = new WebGLState(gl);

  const scissorBox = new Box2({
    min: vec2.fromValues(5, 10),
    max: vec2.fromValues(55, 110),
  });

  webglState.setScissor(scissorBox);

  const actualScissorBox = gl.getParameter(gl.SCISSOR_BOX);
  expect(Array.from(actualScissorBox)).toEqual([5, 10, 50, 100]);
});

test("setScissorBox with floating point values floors to integers", () => {
  const gl = createTestWebGLContext();
  const webglState = new WebGLState(gl);

  const scissorBox = new Box2({
    min: vec2.fromValues(5.7, 10.9),
    max: vec2.fromValues(55.3, 110.1),
  });

  webglState.setScissor(scissorBox);

  const actualScissorBox = gl.getParameter(gl.SCISSOR_BOX);
  expect(Array.from(actualScissorBox)).toEqual([5, 10, 50, 100]);
});

test("setCullFace enables and disables face culling", () => {
  const gl = createTestWebGLContext();
  const webglState = new WebGLState(gl);

  webglState.setCullFace(true);
  expect(gl.isEnabled(gl.CULL_FACE)).toBe(true);

  webglState.setCullFace(false);
  expect(gl.isEnabled(gl.CULL_FACE)).toBe(false);
});

test("setCullFaceMode with 'none' disables face culling", () => {
  const gl = createTestWebGLContext();
  const webglState = new WebGLState(gl);

  webglState.setCullFace(true);
  expect(gl.isEnabled(gl.CULL_FACE)).toBe(true);

  webglState.setCullFaceMode("none");
  expect(gl.isEnabled(gl.CULL_FACE)).toBe(false);
});

test("setCullFaceMode with 'front' enables culling in front face mode", () => {
  const gl = createTestWebGLContext();
  const webglState = new WebGLState(gl);

  webglState.setCullFaceMode("front");
  expect(gl.isEnabled(gl.CULL_FACE)).toBe(true);
  expect(gl.getParameter(gl.CULL_FACE_MODE)).toBe(gl.FRONT);
});

test("setCullFaceMode with 'back' enables culling in back face mode", () => {
  const gl = createTestWebGLContext();
  const webglState = new WebGLState(gl);

  webglState.setCullFaceMode("back");
  expect(gl.isEnabled(gl.CULL_FACE)).toBe(true);
  expect(gl.getParameter(gl.CULL_FACE_MODE)).toBe(gl.BACK);
});

test("setCullFaceMode with 'both' enables culling in front and back face mode", () => {
  const gl = createTestWebGLContext();
  const webglState = new WebGLState(gl);

  webglState.setCullFaceMode("both");
  expect(gl.isEnabled(gl.CULL_FACE)).toBe(true);
  expect(gl.getParameter(gl.CULL_FACE_MODE)).toBe(gl.FRONT_AND_BACK);
});
