import { describe, expect, it } from "vitest";
import { mat4, vec2, vec3 } from "gl-matrix";
import { PlaneView, PlaneViewSampler } from "@/math/plane_view_sampler";
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

const perspective = (distance: number, aspect = 1, tilt = 0, far = 1e4) =>
  mat4.multiply(
    mat4.create(),
    mat4.perspective(mat4.create(), FOV, aspect, 0.1, far),
    lookAt(distance, tilt)
  );

const orthographic = (half: number, distance: number) =>
  mat4.multiply(
    mat4.create(),
    mat4.ortho(mat4.create(), -half, half, -half, half, 0.1, 1e4),
    lookAt(distance)
  );

const extent = (half: number) =>
  new Box2(vec2.fromValues(-half, -half), vec2.fromValues(half, half));

const view = (
  viewProjection: mat4,
  imageExtent = extent(1e6),
  sliceValue: number | undefined = 0,
  buffer = BUFFER
) => sampler.view(viewProjection, XY, sliceValue, imageExtent, buffer);

/** The centre ray's finer axis, which the analytic cases predict. */
const centreUnitsPerPixel = (measured: PlaneView) =>
  measured.rays[CENTRE_RAY].narrow;

describe("PlaneViewSampler", () => {
  it("matches the analytic frustum cross-section at the plane", () => {
    const distance = 100;
    const aspect = 1.5;
    // buffer aspect matches the projection, so both axes agree on the scale
    const { worldViewRect, rays } = view(
      perspective(distance, aspect),
      undefined,
      0,
      {
        width: 800 * aspect,
        height: 800,
      }
    );

    const halfHeight = distance * Math.tan(FOV / 2);
    expect(worldViewRect.min[0]).toBeCloseTo(-halfHeight * aspect, 2);
    expect(worldViewRect.max[1]).toBeCloseTo(halfHeight, 2);
    expect(rays[CENTRE_RAY].narrow).toBeCloseTo((2 * halfHeight) / 800, 3);
  });

  it("recovers the extent and scale for an orthographic camera", () => {
    const half = 40;
    const { worldViewRect, rays } = view(orthographic(half, 100));

    expect(worldViewRect.min[0]).toBeCloseTo(-half, 2);
    expect(worldViewRect.max[1]).toBeCloseTo(half, 2);
    expect(rays[CENTRE_RAY].narrow).toBeCloseTo((2 * half) / BUFFER.width, 4);
  });

  it("ignores the far plane, which only clips the view", () => {
    // tilted so the receding corners meet the plane past a tight far
    const tight = view(perspective(100, 1, 0.6, 130));
    const tightCentre = centreUnitsPerPixel(tight);
    const generous = view(perspective(100, 1, 0.6));

    expect(tight.worldViewRect.max[1]).toBeCloseTo(
      generous.worldViewRect.max[1],
      2
    );
    expect(tightCentre).toBeCloseTo(centreUnitsPerPixel(generous), 4);
  });

  it("clamps the rect to the image's extent", () => {
    const { worldViewRect } = view(orthographic(500, 100), extent(10));

    expect(worldViewRect.min[0]).toBeCloseTo(-10, 4);
    expect(worldViewRect.max[0]).toBeCloseTo(10, 4);
  });

  it("is empty when nothing on the plane is in view", () => {
    const offToTheSide = new Box2(
      vec2.fromValues(1000, 1000),
      vec2.fromValues(2000, 2000)
    );

    for (const { worldViewRect } of [
      view(perspective(100), offToTheSide), // visible region misses the image
      view(perspective(100), undefined, -20000), // plane beyond the far plane
      view(perspective(100), undefined, 500), // plane behind the camera
    ]) {
      expect(worldViewRect.isEmpty()).toBe(true);
    }
  });

  it("falls back to the image extent, measuring nothing, with no slice plane", () => {
    const imageExtent = extent(10);

    // called directly: an explicit undefined would hit `view`'s own default
    const { worldViewRect, rays } = sampler.view(
      perspective(100),
      XY,
      undefined,
      imageExtent,
      BUFFER
    );

    expect(worldViewRect).toEqual(imageExtent);
    expect(rays.every((ray) => ray.narrow === Infinity)).toBe(true);
  });

  it("keeps measuring the rays that land once the horizon is in view", () => {
    // The corner rays miss, so the rect falls back to the extent, but most of
    // the screen is still on the plane and has to go on reporting a footprint.
    for (const tilt of [1.0, 1.2, 1.4, 1.5]) {
      const { rays } = view(perspective(100, 1, tilt), extent(1e6));

      const measured = rays.filter((ray) => Number.isFinite(ray.narrow));
      expect(measured.length).toBeGreaterThan(rays.length / 2);
    }
  });
});
