import { expect, test, vi } from "vitest";
import { vec2 } from "gl-matrix";
import { WebGLState } from "../src/renderers/WebGLState";
import { Box2 } from "../src/math/box2";

// Mock WebGL2RenderingContext for testing
class MockWebGL2Context {
  public viewport = vi.fn();
  public scissor = vi.fn();
  public enable = vi.fn();
  public disable = vi.fn();
  public canvas = { width: 800, height: 600 };

  // WebGL constants
  public readonly SCISSOR_TEST = 0x0c11;
  public readonly DEPTH_TEST = 0x0b71;
  public readonly BLEND = 0x0be2;

  // Mock blend constants
  public readonly SRC_ALPHA = 0x0302;
  public readonly ONE_MINUS_SRC_ALPHA = 0x0303;
  public readonly ONE = 1;
  public readonly ZERO = 0;
  public readonly DST_COLOR = 0x0306;
  public readonly ONE_MINUS_SRC_COLOR = 0x0301;
}

test("setViewport calls gl.viewport with correct parameters", () => {
  const mockGL = new MockWebGL2Context();
  const webglState = new WebGLState(
    mockGL as unknown as WebGL2RenderingContext
  );

  const viewport = new Box2(vec2.fromValues(10, 20), vec2.fromValues(110, 220));

  webglState.setViewport(viewport);

  expect(mockGL.viewport).toHaveBeenCalledWith(10, 20, 100, 200);
  expect(mockGL.viewport).toHaveBeenCalledTimes(1);
});

test("setViewport with floating point values floors to integers", () => {
  const mockGL = new MockWebGL2Context();
  const webglState = new WebGLState(
    mockGL as unknown as WebGL2RenderingContext
  );

  const viewport = new Box2(
    vec2.fromValues(10.7, 20.9),
    vec2.fromValues(110.3, 220.1)
  );

  webglState.setViewport(viewport);

  expect(mockGL.viewport).toHaveBeenCalledWith(10, 20, 99, 199);
});

test("setScissor with explicit scissor box enables scissor test", () => {
  const mockGL = new MockWebGL2Context();
  const webglState = new WebGLState(
    mockGL as unknown as WebGL2RenderingContext
  );

  const scissorBox = new Box2(vec2.fromValues(5, 10), vec2.fromValues(55, 110));

  webglState.setScissor(scissorBox);

  expect(mockGL.enable).toHaveBeenCalledWith(mockGL.SCISSOR_TEST);
  expect(mockGL.scissor).toHaveBeenCalledWith(5, 10, 50, 100);
});

test("setScissor without parameters disables scissor test", () => {
  const mockGL = new MockWebGL2Context();
  const webglState = new WebGLState(
    mockGL as unknown as WebGL2RenderingContext
  );

  const scissorBox = new Box2(vec2.fromValues(5, 10), vec2.fromValues(55, 110));

  // First enable scissor, then disable it
  webglState.setScissor(scissorBox);
  webglState.setScissor();

  expect(mockGL.disable).toHaveBeenCalledWith(mockGL.SCISSOR_TEST);
});

test("setScissor with floating point values floors to integers", () => {
  const mockGL = new MockWebGL2Context();
  const webglState = new WebGLState(
    mockGL as unknown as WebGL2RenderingContext
  );

  const scissorBox = new Box2(
    vec2.fromValues(5.7, 10.9),
    vec2.fromValues(55.3, 110.1)
  );

  webglState.setScissor(scissorBox);

  expect(mockGL.enable).toHaveBeenCalledWith(mockGL.SCISSOR_TEST);
  expect(mockGL.scissor).toHaveBeenCalledWith(5, 10, 49, 99);
});
