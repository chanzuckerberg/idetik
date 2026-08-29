import { mat4, vec2, vec3, vec4 } from "gl-matrix";
import { AxisComponent, SliceAxes } from "./axes";
import { Box2 } from "./box2";
import { Plane } from "./plane";

// At or below this clip w the sample point sits on or behind the eye
const MIN_CLIP_W = 1e-9;

/**
 * Plane-space units covered by one screen pixel along the plane's most and
 * least magnified directions. The two differ wherever the plane is
 * foreshortened, and their ratio is the anisotropy of the view at that point.
 */
export type PlaneFootprint = {
  readonly minUnitsPerScreenPixel: number;
  readonly maxUnitsPerScreenPixel: number;
};

const COARSEST_FOOTPRINT: PlaneFootprint = {
  minUnitsPerScreenPixel: Infinity,
  maxUnitsPerScreenPixel: Infinity,
};

type PlaneCorners = {
  readonly bottomLeft: vec2;
  readonly bottomRight: vec2;
  readonly topLeft: vec2;
  readonly topRight: vec2;
};

type PlaneCornersResult =
  | { kind: "resolved"; corners: PlaneCorners }
  | { kind: "outside" }
  | { kind: "unresolved" };

type PlaneProjection = {
  readonly inverse: mat4;
  readonly plane: Plane;
  readonly u: 0 | 1 | 2;
  readonly v: 0 | 1 | 2;
};

type PlaneRay = {
  readonly point: vec2 | null;
  readonly nearInFront: boolean;
  readonly farInFront: boolean;
};

/** Rows x, y, w of `viewProjection` restricted to the slice plane, mapping
 * homogeneous plane coordinates (u, v, 1) to clip (x, y, w). The z row drops
 * out because depth doesn't affect where a point lands on screen. */
type PlaneToClip = readonly number[];

function unproject(
  inverseViewProjection: mat4,
  ndcX: number,
  ndcY: number,
  ndcZ: number
): vec3 {
  const clip = vec4.transformMat4(
    vec4.create(),
    vec4.fromValues(ndcX, ndcY, ndcZ, 1),
    inverseViewProjection
  );
  const inverseW = 1 / clip[3];
  return vec3.fromValues(
    clip[0] * inverseW,
    clip[1] * inverseW,
    clip[2] * inverseW
  );
}

function planeProjection(
  viewProjection: mat4,
  axes: SliceAxes,
  sliceValue: number
): PlaneProjection | null {
  const inverse = mat4.invert(mat4.create(), viewProjection);
  if (!inverse) return null;

  const normal = vec3.create();
  normal[AxisComponent[axes.w]] = 1;

  return {
    inverse,
    plane: new Plane(normal, -sliceValue),
    u: AxisComponent[axes.u],
    v: AxisComponent[axes.v],
  };
}

/** Where the ray through an NDC position meets the plane, and which side of it
 * the frustum's near and far points fall on. */
function planePointAt(
  projection: PlaneProjection,
  ndcX: number,
  ndcY: number
): PlaneRay {
  const { inverse, plane, u, v } = projection;
  const near = unproject(inverse, ndcX, ndcY, -1);
  const far = unproject(inverse, ndcX, ndcY, 1);

  const nearInFront = plane.signedDistanceToPoint(near) >= 0;
  const farInFront = plane.signedDistanceToPoint(far) >= 0;

  const toFar = vec3.subtract(vec3.create(), far, near);
  const t = plane.intersectionParameter(near, toFar);
  const point =
    t === null || t < 0
      ? null
      : vec2.fromValues(near[u] + t * toFar[u], near[v] + t * toFar[v]);

  return { point, nearInFront, farInFront };
}

function visiblePlaneCorners(projection: PlaneProjection): PlaneCornersResult {
  let anyInFront = false;
  let anyBehind = false;

  const corner = (ndcX: number, ndcY: number): vec2 | null => {
    const ray = planePointAt(projection, ndcX, ndcY);
    if (ray.nearInFront || ray.farInFront) anyInFront = true;
    if (!ray.nearInFront || !ray.farInFront) anyBehind = true;
    return ray.point;
  };

  const bottomLeft = corner(-1, -1);
  const bottomRight = corner(1, -1);
  const topLeft = corner(-1, 1);
  const topRight = corner(1, 1);

  if (!anyInFront || !anyBehind) return { kind: "outside" };
  if (!bottomLeft || !bottomRight || !topLeft || !topRight) {
    return { kind: "unresolved" };
  }

  return {
    kind: "resolved",
    corners: { bottomLeft, bottomRight, topLeft, topRight },
  };
}

function planeToClip(
  viewProjection: mat4,
  axes: SliceAxes,
  sliceValue: number
): PlaneToClip {
  const m = viewProjection;
  const u = AxisComponent[axes.u] * 4;
  const v = AxisComponent[axes.v] * 4;
  const w = AxisComponent[axes.w] * 4;
  const t = 12; // translation column

  // prettier-ignore
  return [
    m[u],     m[v],     m[w]     * sliceValue + m[t],
    m[u + 1], m[v + 1], m[w + 1] * sliceValue + m[t + 1],
    m[u + 3], m[v + 3], m[w + 3] * sliceValue + m[t + 3],
  ];
}

/**
 * The plane-to-screen map is projective, so its derivative varies across the
 * plane and has to be evaluated somewhere specific. The singular values of the
 * Jacobian there are the extremes of the pixel footprint.
 */
function footprintAt(
  h: PlaneToClip,
  point: vec2,
  bufferSizePx: { width: number; height: number }
): PlaneFootprint {
  const [u, v] = point;
  const x = h[0] * u + h[1] * v + h[2];
  const y = h[3] * u + h[4] * v + h[5];
  const w = h[6] * u + h[7] * v + h[8];
  if (!(w > MIN_CLIP_W) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return COARSEST_FOOTPRINT;
  }

  // d(ndc)/d(u, v) by the quotient rule, scaled from ndc to pixels
  const inverseWSquared = 1 / (w * w);
  const halfWidth = bufferSizePx.width / 2;
  const halfHeight = bufferSizePx.height / 2;
  const a = halfWidth * (h[0] * w - x * h[6]) * inverseWSquared;
  const b = halfWidth * (h[1] * w - x * h[7]) * inverseWSquared;
  const c = halfHeight * (h[3] * w - y * h[6]) * inverseWSquared;
  const d = halfHeight * (h[4] * w - y * h[7]) * inverseWSquared;

  const mean = (a * a + b * b + c * c + d * d) / 2;
  const spread = Math.hypot((a * a + b * b - c * c - d * d) / 2, a * c + b * d);
  const major = Math.sqrt(Math.max(0, mean + spread));
  const minor = Math.sqrt(Math.max(0, mean - spread));

  return {
    minUnitsPerScreenPixel: major > 0 ? 1 / major : Infinity,
    maxUnitsPerScreenPixel: minor > 0 ? 1 / minor : Infinity,
  };
}

/**
 * Sampled on a grid in screen space rather than at one point in plane space.
 * The plane's world-space midpoint is dragged around by its most distant
 * corner, which recedes without bound as the plane tips towards edge-on; an
 * even spread across the viewport instead tracks what most of the screen
 * actually shows, and moves smoothly as the camera turns.
 */
const SAMPLE_NDC = [-2 / 3, 0, 2 / 3];

function medianFootprint(
  projection: PlaneProjection,
  planeToClipRows: PlaneToClip,
  worldViewRect: Box2,
  bufferSizePx: { width: number; height: number }
): PlaneFootprint {
  const footprints: PlaneFootprint[] = [];
  const sample = vec2.create();

  for (const ndcY of SAMPLE_NDC) {
    for (const ndcX of SAMPLE_NDC) {
      const { point } = planePointAt(projection, ndcX, ndcY);
      // A ray that never meets the plane is looking past its horizon, which is
      // a vote for the coarsest data rather than a sample to discard.
      if (!point) {
        footprints.push(COARSEST_FOOTPRINT);
        continue;
      }

      // Samples that land off the data would report a footprint for chunks we
      // are not going to load.
      vec2.max(sample, point, worldViewRect.min);
      vec2.min(sample, sample, worldViewRect.max);
      footprints.push(footprintAt(planeToClipRows, sample, bufferSizePx));
    }
  }

  // Infinities make a subtracting comparator return NaN.
  footprints.sort((a, b) =>
    a.minUnitsPerScreenPixel < b.minUnitsPerScreenPixel
      ? -1
      : a.minUnitsPerScreenPixel > b.minUnitsPerScreenPixel
        ? 1
        : 0
  );
  return footprints[footprints.length >> 1];
}

/**
 * The rect never under-covers the data; bounds a trapezoid in perspective, and
 * corners beyond the far plane still count since they will only clip the view.
 *
 * Returns an empty rect when nothing is visible, and the image extent with a
 * `COARSEST_FOOTPRINT` when the view can't be resolved.
 */
export function planeView(
  viewProjection: mat4,
  axes: SliceAxes,
  sliceValue: number | undefined,
  imageExtent: Box2,
  bufferSizePx: { width: number; height: number }
): { worldViewRect: Box2; footprint: PlaneFootprint } {
  if (sliceValue === undefined) {
    return { worldViewRect: imageExtent, footprint: COARSEST_FOOTPRINT };
  }

  const projection = planeProjection(viewProjection, axes, sliceValue);
  if (!projection) {
    return { worldViewRect: imageExtent, footprint: COARSEST_FOOTPRINT };
  }

  const result = visiblePlaneCorners(projection);

  switch (result.kind) {
    case "resolved": {
      const { bottomLeft, bottomRight, topLeft, topRight } = result.corners;
      const min = vec2.min(vec2.create(), bottomLeft, bottomRight);
      const max = vec2.max(vec2.create(), bottomLeft, bottomRight);
      vec2.min(min, min, topLeft);
      vec2.min(min, min, topRight);
      vec2.max(max, max, topLeft);
      vec2.max(max, max, topRight);
      vec2.max(min, min, imageExtent.min);
      vec2.min(max, max, imageExtent.max);

      const worldViewRect = new Box2(min, max);
      if (worldViewRect.isEmpty()) {
        return { worldViewRect, footprint: COARSEST_FOOTPRINT };
      }

      return {
        worldViewRect,
        footprint: medianFootprint(
          projection,
          planeToClip(viewProjection, axes, sliceValue),
          worldViewRect,
          bufferSizePx
        ),
      };
    }
    case "outside":
      return { worldViewRect: new Box2(), footprint: COARSEST_FOOTPRINT };
    case "unresolved":
      return {
        worldViewRect: imageExtent,
        footprint: imageExtent.isEmpty()
          ? COARSEST_FOOTPRINT
          : medianFootprint(
              projection,
              planeToClip(viewProjection, axes, sliceValue),
              imageExtent,
              bufferSizePx
            ),
      };
  }
}
