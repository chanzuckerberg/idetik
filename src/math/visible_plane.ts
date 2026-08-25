import { mat4, vec2, vec3, vec4 } from "gl-matrix";
import { AxisComponent, SliceAxes } from "./axes";
import { Box2 } from "./box2";
import { Plane } from "./plane";

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

function visiblePlaneCorners(
  viewProjection: mat4,
  axes: SliceAxes,
  sliceValue: number
): PlaneCornersResult {
  const inverse = mat4.invert(mat4.create(), viewProjection);
  if (!inverse) return { kind: "unresolved" };

  const u = AxisComponent[axes.u];
  const v = AxisComponent[axes.v];

  const normal = vec3.create();
  normal[AxisComponent[axes.w]] = 1;
  const plane = new Plane(normal, -sliceValue);

  let anyInFront = false;
  let anyBehind = false;

  const corner = (ndcX: number, ndcY: number): vec2 | null => {
    const near = unproject(inverse, ndcX, ndcY, -1);
    const far = unproject(inverse, ndcX, ndcY, 1);

    const nearInFront = plane.signedDistanceToPoint(near) >= 0;
    const farInFront = plane.signedDistanceToPoint(far) >= 0;
    if (nearInFront || farInFront) anyInFront = true;
    if (!nearInFront || !farInFront) anyBehind = true;

    const toFar = vec3.subtract(vec3.create(), far, near);

    const t = plane.intersectionParameter(near, toFar);
    if (t === null || t < 0) return null;

    return vec2.fromValues(near[u] + t * toFar[u], near[v] + t * toFar[v]);
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

function unitsPerScreenPixel(
  corners: PlaneCorners,
  bufferSizePx: { width: number; height: number }
): number {
  const { bottomLeft, bottomRight, topLeft, topRight } = corners;
  // the coarsest edge is conservative, so we don't load LOD0 for an edge-on plane
  return Math.max(
    vec2.distance(bottomLeft, bottomRight) / bufferSizePx.width,
    vec2.distance(topLeft, topRight) / bufferSizePx.width,
    vec2.distance(bottomLeft, topLeft) / bufferSizePx.height,
    vec2.distance(bottomRight, topRight) / bufferSizePx.height
  );
}

/**
 * The rect never under-covers the data; bounds a trapezoid in perspective, and
 * corners beyond the far plane still count since they will only clip the view.
 *
 * Retruns an empty rect when nothing is visible.
 * Returns the image extent with Infinity `unitsPerScreenPixel` when the view
 * can't be resolved (clamps to coarsest available LOD).
 */
export function planeView(
  viewProjection: mat4,
  axes: SliceAxes,
  sliceValue: number | undefined,
  imageExtent: Box2,
  bufferSizePx: { width: number; height: number }
): { worldViewRect: Box2; unitsPerScreenPixel: number } {
  const result: PlaneCornersResult =
    sliceValue === undefined
      ? { kind: "unresolved" }
      : visiblePlaneCorners(viewProjection, axes, sliceValue);

  switch (result.kind) {
    case "resolved": {
      const { corners } = result;
      const { bottomLeft, bottomRight, topLeft, topRight } = corners;
      const min = vec2.min(vec2.create(), bottomLeft, bottomRight);
      const max = vec2.max(vec2.create(), bottomLeft, bottomRight);
      vec2.min(min, min, topLeft);
      vec2.min(min, min, topRight);
      vec2.max(max, max, topLeft);
      vec2.max(max, max, topRight);
      vec2.max(min, min, imageExtent.min);
      vec2.min(max, max, imageExtent.max);

      return {
        worldViewRect: new Box2(min, max),
        unitsPerScreenPixel: unitsPerScreenPixel(corners, bufferSizePx),
      };
    }
    case "outside":
      return { worldViewRect: new Box2(), unitsPerScreenPixel: Infinity };
    case "unresolved":
      return { worldViewRect: imageExtent, unitsPerScreenPixel: Infinity };
  }
}
