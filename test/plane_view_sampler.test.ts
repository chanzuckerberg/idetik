import { describe, expect, it } from "vitest";
import { mat4, vec2, vec3 } from "gl-matrix";
import { PlaneViewSampler } from "@/math/plane_view_sampler";
import { Box2 } from "@/math/box2";
import { sliceAxesFor } from "@/math/axes";
import { MAX_LOD_ANISOTROPY } from "@/data/chunk_store_view";

const XY = sliceAxesFor("XY");
const sampler = new PlaneViewSampler();
const planeView = sampler.view.bind(sampler);
const FOV = Math.PI / 3;
const BUFFER = { width: 800, height: 800 };

/** Looking at the origin from `distance`, tilted about x. */
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
) => planeView(viewProjection, XY, sliceValue, imageExtent, buffer);

describe("planeView", () => {
  it("matches the analytic frustum cross-section at the plane", () => {
    const distance = 100;
    const aspect = 1.5;
    // buffer aspect matches the projection, so both axes agree on the scale
    const { worldViewRect, footprint } = view(
      perspective(distance, aspect),
      undefined,
      0,
      { width: 800 * aspect, height: 800 }
    );

    const halfHeight = distance * Math.tan(FOV / 2);
    expect(worldViewRect.min[0]).toBeCloseTo(-halfHeight * aspect, 2);
    expect(worldViewRect.max[1]).toBeCloseTo(halfHeight, 2);
    expect(footprint.minUnitsPerScreenPixel).toBeCloseTo(
      (2 * halfHeight) / 800,
      3
    );
  });

  it("recovers the extent and scale for an orthographic camera", () => {
    const half = 40;
    const { worldViewRect, footprint } = view(orthographic(half, 100));

    expect(worldViewRect.min[0]).toBeCloseTo(-half, 2);
    expect(worldViewRect.max[1]).toBeCloseTo(half, 2);
    expect(footprint.minUnitsPerScreenPixel).toBeCloseTo(
      (2 * half) / BUFFER.width,
      4
    );
  });

  // Mirrors the clamp `ChunkStoreView.setLOD` applies to pick a level.
  const sampledAt = (
    footprint: {
      minUnitsPerScreenPixel: number;
      maxUnitsPerScreenPixel: number;
    },
    maxAnisotropy = MAX_LOD_ANISOTROPY
  ) =>
    Math.max(
      footprint.minUnitsPerScreenPixel,
      footprint.maxUnitsPerScreenPixel / maxAnisotropy
    );

  it("holds face-on detail within the anisotropy budget, then coarsens", () => {
    const samples = [];
    for (let deg = 0; deg <= 85; deg += 5) {
      const tilt = (deg * Math.PI) / 180;
      const { footprint } = view(perspective(100, 1, tilt));
      samples.push({
        level: Math.log2(sampledAt(footprint)),
        anisotropy:
          footprint.maxUnitsPerScreenPixel / footprint.minUnitsPerScreenPixel,
      });
    }

    const levels = samples.map((s) => s.level);
    const faceOn = levels[0];
    const withinBudget = samples.filter(
      (s) => s.anisotropy <= MAX_LOD_ANISOTROPY
    );
    const beyondBudget = samples.filter(
      (s) => s.anisotropy > MAX_LOD_ANISOTROPY
    );

    // The sweep has to straddle the clamp for either half to mean anything
    expect(withinBudget.length).toBeGreaterThan(1);
    expect(beyondBudget.length).toBeGreaterThan(1);

    // Inside the budget the unforeshortened axis sets the level, so tilting
    // holds face-on detail rather than trading it away, and cannot run away
    // into loading finer data than face-on needed either.
    for (const { level } of withinBudget) {
      expect(level).toBeLessThanOrEqual(faceOn);
      expect(level).toBeGreaterThan(faceOn - 0.25);
    }

    // Past it the coarser axis takes over and 1/cos drives the level up
    for (let i = 1; i < beyondBudget.length; ++i) {
      expect(beyondBudget[i].level).toBeGreaterThan(beyondBudget[i - 1].level);
    }

    // Through the angles worth working at, no 5 degree step covers half a
    // level, so tilting cannot skip an LOD. Past that the plane is nearly
    // edge-on and 1/cos runs away on its own.
    for (let i = 1; i <= 60 / 5; ++i) {
      expect(Math.abs(levels[i] - levels[i - 1])).toBeLessThan(0.5);
    }

    // Edge-on still gives up several levels relative to face-on
    expect(levels[levels.length - 1] - faceOn).toBeGreaterThan(2);
  });

  it("coarsens monotonically as the camera pulls back", () => {
    const rates = [27, 54, 108, 216].map((d) =>
      sampledAt(view(perspective(d, 1, 0.7)).footprint)
    );

    // Each doubling of distance is exactly one LOD step, so no level is skipped
    for (let i = 1; i < rates.length; ++i) {
      expect(Math.log2(rates[i] / rates[i - 1])).toBeCloseTo(1, 3);
    }
  });

  it("reports anisotropy only where the plane is foreshortened", () => {
    const faceOn = view(perspective(100)).footprint;
    expect(
      faceOn.maxUnitsPerScreenPixel / faceOn.minUnitsPerScreenPixel
    ).toBeCloseTo(1, 5);

    const oblique = view(perspective(100, 1, 0.9)).footprint;
    expect(
      oblique.maxUnitsPerScreenPixel / oblique.minUnitsPerScreenPixel
    ).toBeGreaterThan(1.5);
  });

  it("ignores the far plane, which only clips the view", () => {
    // tilted so the receding corners meet the plane past a tight far
    const tight = view(perspective(100, 1, 0.6, 130));
    const generous = view(perspective(100, 1, 0.6));

    // float32 projection coefficients shift slightly with far
    expect(tight.worldViewRect.max[1]).toBeCloseTo(
      generous.worldViewRect.max[1],
      2
    );
    expect(tight.footprint.minUnitsPerScreenPixel).toBeCloseTo(
      generous.footprint.minUnitsPerScreenPixel,
      4
    );
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

  it("falls back to the image extent when the view cannot be resolved", () => {
    const imageExtent = extent(10);

    for (const result of [
      view(perspective(100, 1, 1.2), imageExtent), // horizon in view
      // passing undefined through `view` would hit its default, so call directly
      planeView(perspective(100), XY, undefined, imageExtent, BUFFER),
    ]) {
      expect(result.worldViewRect).toEqual(imageExtent);
    }
  });

  it("still samples the rays that land when the horizon is in view", () => {
    // The corner rays miss, but most of the screen is still on the plane, so
    // the level should degrade with the horizon rather than drop off a cliff.
    const rates = [1.0, 1.2, 1.4, 1.5].map((tilt) =>
      sampledAt(view(perspective(100, 1, tilt), extent(1e6)).footprint)
    );

    for (const rate of rates) expect(Number.isFinite(rate)).toBe(true);

    // Flat until the anisotropy clamp engages, never a step backwards
    for (let i = 1; i < rates.length; ++i) {
      expect(rates[i]).toBeGreaterThan(rates[i - 1] * 0.99);
    }
    expect(rates[rates.length - 1]).toBeGreaterThan(rates[0] * 2);
  });

  it("keeps a finite rate however the horizon falls across the viewport", () => {
    // The horizon's height in the viewport depends on both tilt and field of
    // view, and rays above it contribute nothing. A wide field of view at high
    // tilt brings it almost to the centre, which is as far as it can go while
    // the plane is still visible, and the median has to hold up there. Beyond
    // this range the plane is edge-on to within rounding and the coarsest
    // level is the honest answer, which the next case covers.
    for (const fov of [Math.PI / 3, Math.PI / 2, (5 * Math.PI) / 6]) {
      let previous = -Infinity;
      for (const deg of [60, 70, 80, 85, 89]) {
        const tilt = (deg * Math.PI) / 180;
        const projection = mat4.multiply(
          mat4.create(),
          mat4.perspective(mat4.create(), fov, 1, 0.1, 1e5),
          lookAt(100, tilt)
        );
        const rate = sampledAt(
          planeView(projection, XY, 0, extent(1e6), BUFFER).footprint
        );

        expect(Number.isFinite(rate)).toBe(true);
        expect(rate).toBeGreaterThan(previous);
        previous = rate;
      }
    }
  });

  it("gives up on a plane that is edge-on to within rounding", () => {
    const projection = mat4.multiply(
      mat4.create(),
      mat4.perspective(mat4.create(), FOV, 1, 0.1, 1e5),
      lookAt(100, (89.99 * Math.PI) / 180)
    );

    // Not the horizon clipping samples -- the surviving ones are squeezed so
    // hard that the narrow side of the footprint underflows to nothing.
    expect(
      sampledAt(planeView(projection, XY, 0, extent(1e6), BUFFER).footprint)
    ).toBe(Infinity);
  });

  it("has no sampling rate when there is no slice plane to sample", () => {
    const { footprint } = planeView(
      perspective(100),
      XY,
      undefined,
      extent(10),
      BUFFER
    );

    expect(footprint.minUnitsPerScreenPixel).toBe(Infinity);
    expect(footprint.maxUnitsPerScreenPixel).toBe(Infinity);
  });
});
