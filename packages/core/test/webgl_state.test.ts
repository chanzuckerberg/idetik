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

  const viewport = new Box2(vec2.fromValues(10, 20), vec2.fromValues(110, 220));

  webglState.setViewport(viewport);

  const actualViewport = gl.getParameter(gl.VIEWPORT);
  expect(Array.from(actualViewport)).toEqual([10, 20, 100, 200]);
});

test("setViewport with floating point values floors to integers", () => {
  const gl = createTestWebGLContext();
  const webglState = new WebGLState(gl);

  const viewport = new Box2(
    vec2.fromValues(10.7, 20.9),
    vec2.fromValues(110.3, 220.1)
  );

  webglState.setViewport(viewport);

  const actualViewport = gl.getParameter(gl.VIEWPORT);
  expect(Array.from(actualViewport)).toEqual([10, 20, 99, 199]);
});

test("setScissor with explicit scissor box enables scissor test", () => {
  const gl = createTestWebGLContext();
  const webglState = new WebGLState(gl);

  const scissorBox = new Box2(vec2.fromValues(5, 10), vec2.fromValues(55, 110));

  webglState.setScissor(scissorBox);

  expect(gl.isEnabled(gl.SCISSOR_TEST)).toBe(true);
  const actualScissorBox = gl.getParameter(gl.SCISSOR_BOX);
  expect(Array.from(actualScissorBox)).toEqual([5, 10, 50, 100]);
});

test("setScissor without parameters disables scissor test", () => {
  const gl = createTestWebGLContext();
  const webglState = new WebGLState(gl);

  const scissorBox = new Box2(vec2.fromValues(5, 10), vec2.fromValues(55, 110));

  // First enable scissor, then disable it
  webglState.setScissor(scissorBox);
  expect(gl.isEnabled(gl.SCISSOR_TEST)).toBe(true);

  webglState.setScissor();
  expect(gl.isEnabled(gl.SCISSOR_TEST)).toBe(false);
});

test("setScissor with floating point values floors to integers", () => {
  const gl = createTestWebGLContext();
  const webglState = new WebGLState(gl);

  const scissorBox = new Box2(
    vec2.fromValues(5.7, 10.9),
    vec2.fromValues(55.3, 110.1)
  );

  webglState.setScissor(scissorBox);

  expect(gl.isEnabled(gl.SCISSOR_TEST)).toBe(true);
  const actualScissorBox = gl.getParameter(gl.SCISSOR_BOX);
  expect(Array.from(actualScissorBox)).toEqual([5, 10, 49, 99]);
});

test("setViewport updates existing viewport", () => {
  const gl = createTestWebGLContext();
  const webglState = new WebGLState(gl);

  // Set initial viewport
  const viewport1 = new Box2(
    vec2.fromValues(10, 20),
    vec2.fromValues(110, 220)
  );
  webglState.setViewport(viewport1);

  let actualViewport = gl.getParameter(gl.VIEWPORT);
  expect(Array.from(actualViewport)).toEqual([10, 20, 100, 200]);

  // Update to new viewport
  const viewport2 = new Box2(
    vec2.fromValues(50, 60),
    vec2.fromValues(250, 360)
  );
  webglState.setViewport(viewport2);

  actualViewport = gl.getParameter(gl.VIEWPORT);
  expect(Array.from(actualViewport)).toEqual([50, 60, 200, 300]);
});

test("setViewport without parameters uses default canvas size", () => {
  const gl = createTestWebGLContext();
  const webglState = new WebGLState(gl);

  webglState.setViewport();

  const actualViewport = gl.getParameter(gl.VIEWPORT);
  expect(Array.from(actualViewport)).toEqual([0, 0, 800, 600]);
});

test("setScissor updates existing scissor box", () => {
  const gl = createTestWebGLContext();
  const webglState = new WebGLState(gl);

  // Set initial scissor
  const scissorBox1 = new Box2(
    vec2.fromValues(10, 20),
    vec2.fromValues(110, 220)
  );
  webglState.setScissor(scissorBox1);

  expect(gl.isEnabled(gl.SCISSOR_TEST)).toBe(true);
  let actualScissorBox = gl.getParameter(gl.SCISSOR_BOX);
  expect(Array.from(actualScissorBox)).toEqual([10, 20, 100, 200]);

  // Update to new scissor box
  const scissorBox2 = new Box2(
    vec2.fromValues(50, 60),
    vec2.fromValues(250, 360)
  );
  webglState.setScissor(scissorBox2);

  expect(gl.isEnabled(gl.SCISSOR_TEST)).toBe(true);
  actualScissorBox = gl.getParameter(gl.SCISSOR_BOX);
  expect(Array.from(actualScissorBox)).toEqual([50, 60, 200, 300]);
});
