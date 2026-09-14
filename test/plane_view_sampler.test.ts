import { describe, expect, it } from "vitest";
import { mat4, vec2, vec3 } from "gl-matrix";
import { PlaneViewSampler } from "@/math/plane_view_sampler";
import { Box2 } from "@/math/box2";
import { sliceAxesFor } from "@/math/axes";

const XY = sliceAxesFor("XY");
const FOV = Math.PI / 3;
const CAMERA_DISTANCE = 100;
const BUFFER = { width: 1200, height: 800 };
const ASPECT = BUFFER.width / BUFFER.height;
const CENTRE_RAY = 4;
const FLOAT32_EPSILON = 1.2e-7;

// wider than any view below, so the rect is never clamped to it
const WHOLE_IMAGE = new Box2(
  vec2.fromValues(-1e6, -1e6),
  vec2.fromValues(1e6, 1e6)
);

const sampler = new PlaneViewSampler();

/** Looking down the plane's normal at the origin, from `CAMERA_DISTANCE`. */
const faceOn = () =>
  mat4.lookAt(
    mat4.create(),
    vec3.fromValues(0, 0, CAMERA_DISTANCE),
    vec3.fromValues(0, 0, 0),
    vec3.fromValues(0, 1, 0)
  );

const perspective = () =>
  mat4.multiply(
    mat4.create(),
    mat4.perspective(mat4.create(), FOV, ASPECT, 0.1, 1e4),
    faceOn()
  );

const orthographic = (halfU: number, halfV: number) =>
  mat4.multiply(
    mat4.create(),
    mat4.ortho(mat4.create(), -halfU, halfU, -halfV, halfV, 0.1, 1e4),
    faceOn()
  );

const view = (viewProjection: mat4, sliceValue: number) =>
  sampler.view(viewProjection, XY, sliceValue, WHOLE_IMAGE, BUFFER);

// Only these two cases have an exact answer to check against. Under a tilted
// perspective the footprint is one estimate standing in for a range of scales
// across the view, so what matters there is the level it leads to, which
// `chunk_store_view.test.ts` asserts over as a property of distance and tilt.
describe("PlaneViewSampler", () => {
  it("measures an exact, uniform footprint for an orthographic view", () => {
    // half-extents in the buffer's aspect, so both axes agree on the scale
    const [halfU, halfV] = [60, 40];
    const { worldViewRect, footprints } = view(orthographic(halfU, halfV), 0);

    expect(worldViewRect.min[0]).toBeCloseTo(-halfU, 2);
    expect(worldViewRect.max[1]).toBeCloseTo(halfV, 2);

    // Affine projection: every pixel covers the same area of the plane, so this
    // is the footprint's exact value, up to gl-matrix's single precision.
    const unitsPerPixel = Math.sqrt(
      ((2 * halfU) / BUFFER.width) * ((2 * halfV) / BUFFER.height)
    );
    const spread = Math.max(...footprints) - Math.min(...footprints);
    expect(spread / unitsPerPixel).toBeLessThan(FLOAT32_EPSILON);
    for (const footprint of footprints) {
      expect(Math.abs(footprint - unitsPerPixel) / unitsPerPixel).toBeLessThan(
        FLOAT32_EPSILON
      );
    }
  });

  // A slice off the origin sits nearer the camera and resolves finer, which is
  // what makes the cross-axis term of the plane-to-clip mapping matter; an
  // orthographic view is insensitive to it, since shifting the plane along its
  // own normal only translates an affine projection.
  it.each([0, 40])(
    "matches the analytic frustum cross-section and scale at slice %i",
    (slice) => {
      const { worldViewRect, footprints } = view(perspective(), slice);

      const half = (CAMERA_DISTANCE - slice) * Math.tan(FOV / 2);
      expect(worldViewRect.min[0]).toBeCloseTo(-half * ASPECT, 2);
      expect(worldViewRect.max[1]).toBeCloseTo(half, 2);
      expect(footprints[CENTRE_RAY]).toBeCloseTo((2 * half) / BUFFER.height, 3);
    }
  );
});
