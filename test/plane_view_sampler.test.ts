import { describe, expect, it } from "vitest";
import { mat4, vec2, vec3 } from "gl-matrix";
import { PlaneViewSampler } from "@/math/plane_view_sampler";
import { Box2 } from "@/math/box2";
import { sliceAxesFor } from "@/math/axes";

const XY = sliceAxesFor("XY");
const FOV = Math.PI / 3;
const BUFFER = { width: 800, height: 800 };
const CENTRE_RAY = 4;

const sampler = new PlaneViewSampler();

/** Looking at the origin from `distance`, tilted off the plane's normal. */
const lookAt = (distance: number, tilt = 0) =>
  mat4.lookAt(
    mat4.create(),
    vec3.fromValues(0, -distance * Math.sin(tilt), distance * Math.cos(tilt)),
    vec3.fromValues(0, 0, 0),
    vec3.fromValues(0, 1, 0)
  );

const perspective = (aspect = 1, tilt = 0, far = 1e4) =>
  mat4.multiply(
    mat4.create(),
    mat4.perspective(mat4.create(), FOV, aspect, 0.1, far),
    lookAt(100, tilt)
  );

const orthographic = (half: number) =>
  mat4.multiply(
    mat4.create(),
    mat4.ortho(mat4.create(), -half, half, -half, half, 0.1, 1e4),
    lookAt(100)
  );

const extent = (half: number) =>
  new Box2(vec2.fromValues(-half, -half), vec2.fromValues(half, half));

const view = (
  viewProjection: mat4,
  imageExtent = extent(1e6),
  sliceValue: number | undefined = 0,
  buffer = BUFFER
) => sampler.view(viewProjection, XY, sliceValue, imageExtent, buffer);

describe("PlaneViewSampler", () => {
  it("matches the analytic frustum cross-section and scale", () => {
    const aspect = 1.5;
    // buffer aspect matches the projection, so both axes agree on the scale
    const { worldViewRect, footprints } = view(
      perspective(aspect),
      undefined,
      0,
      {
        width: BUFFER.width * aspect,
        height: BUFFER.height,
      }
    );

    const half = 100 * Math.tan(FOV / 2);
    expect(worldViewRect.min[0]).toBeCloseTo(-half * aspect, 2);
    expect(worldViewRect.max[1]).toBeCloseTo(half, 2);
    expect(footprints[CENTRE_RAY]).toBeCloseTo((2 * half) / BUFFER.height, 3);
  });

  it("recovers the extent and scale for an orthographic camera", () => {
    const { worldViewRect, footprints } = view(orthographic(40));

    expect(worldViewRect.min[0]).toBeCloseTo(-40, 2);
    expect(worldViewRect.max[1]).toBeCloseTo(40, 2);
    expect(footprints[CENTRE_RAY]).toBeCloseTo(80 / BUFFER.width, 4);
  });

  it("ignores the far plane, which only clips the view", () => {
    // tilted so the receding corners meet the plane past a tight far
    const tight = view(perspective(1, 0.6, 130));
    const generous = view(perspective(1, 0.6));

    expect(tight.worldViewRect.max[1]).toBeCloseTo(
      generous.worldViewRect.max[1],
      2
    );
    expect(tight.footprints[CENTRE_RAY]).toBeCloseTo(
      generous.footprints[CENTRE_RAY],
      4
    );
  });

  it("clamps the rect to the image's extent", () => {
    const { worldViewRect } = view(orthographic(500), extent(10));

    expect(worldViewRect.min[0]).toBeCloseTo(-10, 4);
    expect(worldViewRect.max[0]).toBeCloseTo(10, 4);
  });

  it("is empty when nothing on the plane is in view", () => {
    const aside = new Box2(
      vec2.fromValues(1000, 1000),
      vec2.fromValues(2000, 2000)
    );

    for (const { worldViewRect } of [
      view(perspective(), aside), // visible region misses the image
      view(perspective(), undefined, -20000), // plane beyond the far plane
      view(perspective(), undefined, 500), // plane behind the camera
    ]) {
      expect(worldViewRect.isEmpty()).toBe(true);
    }
  });

  it("falls back to the extent, measuring nothing, with no slice plane", () => {
    // called directly: an explicit undefined would hit `view`'s own default
    const { worldViewRect, footprints } = sampler.view(
      perspective(),
      XY,
      undefined,
      extent(10),
      BUFFER
    );

    expect(worldViewRect).toEqual(extent(10));
    expect(footprints.every((units) => units === Infinity)).toBe(true);
  });

  it("keeps measuring the rays that land once the horizon is in view", () => {
    // The corner rays miss, so the rect falls back to the extent, but most of
    // the screen still shows the plane and must go on reporting a footprint.
    for (const tilt of [1.0, 1.2, 1.4, 1.5]) {
      const { footprints } = view(perspective(1, tilt), extent(1e6));

      const measured = footprints.filter(Number.isFinite).length;
      expect(measured).toBeGreaterThan(footprints.length / 2);
    }
  });
});
