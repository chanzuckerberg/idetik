import { mat3, mat4, vec2, vec3 } from "gl-matrix";
import { AxisComponent, SliceAxes } from "./axes";
import { Box2 } from "./box2";

const MIN_CLIP_W = 1e-9;
const MIN_APPROACH_COSINE_SQUARED = 1e-6 * 1e-6;

const SAMPLE_NDC = [-2 / 3, 0, 2 / 3];
const CORNER_NDC_X = [-1, 1, -1, 1];
const CORNER_NDC_Y = [-1, -1, 1, 1];

const RAY_COUNT = SAMPLE_NDC.length ** 2;

const unmeasuredFootprints = (): number[] =>
  new Array(RAY_COUNT).fill(Infinity);

export type PlaneView = {
  readonly worldViewRect: Box2;
  readonly footprints: readonly number[];
};

type RayHit = {
  readonly hit: boolean;
  readonly u: number;
  readonly v: number;
  readonly nearInFront: boolean;
  readonly farInFront: boolean;
};

export class PlaneViewSampler {
  private u_ = 0;
  private v_ = 1;
  private w_ = 2;
  private sliceValue_ = 0;

  private readonly scratch_ = {
    inverse: mat4.create(),
    ndc: vec3.create(),
    near: vec3.create(),
    far: vec3.create(),
    toFar: vec3.create(),
    cornerUV: new Float64Array(8),
    planeToClip: mat3.create(),
    adjugate: mat3.create(),
    boxMin: vec2.create(),
    boxMax: vec2.create(),
  };

  public view(
    viewProjection: mat4,
    axes: SliceAxes,
    sliceValue: number | undefined,
    imageExtent: Box2,
    bufferSizePx: { width: number; height: number }
  ): PlaneView {
    if (
      sliceValue === undefined ||
      !mat4.invert(this.scratch_.inverse, viewProjection)
    )
      return { worldViewRect: imageExtent, footprints: unmeasuredFootprints() };

    this.u_ = AxisComponent[axes.u];
    this.v_ = AxisComponent[axes.v];
    this.w_ = AxisComponent[axes.w];
    this.sliceValue_ = sliceValue;

    const { cornerUV } = this.scratch_;
    let anyInFront = false;
    let anyBehind = false;
    let allCornersHit = true;

    for (let i = 0; i < 4; ++i) {
      const corner = this.intersect(CORNER_NDC_X[i], CORNER_NDC_Y[i]);
      if (corner.nearInFront || corner.farInFront) anyInFront = true;
      if (!corner.nearInFront || !corner.farInFront) anyBehind = true;
      if (!corner.hit) allCornersHit = false;
      cornerUV[i * 2] = corner.u;
      cornerUV[i * 2 + 1] = corner.v;
    }

    if (!anyInFront || !anyBehind) {
      return { worldViewRect: new Box2(), footprints: unmeasuredFootprints() };
    }

    const worldViewRect = allCornersHit
      ? this.cornerBounds(imageExtent)
      : imageExtent;
    return {
      worldViewRect,
      footprints: worldViewRect.isEmpty()
        ? unmeasuredFootprints()
        : this.measureFootprints(viewProjection, bufferSizePx),
    };
  }

  private intersect(ndcX: number, ndcY: number): RayHit {
    const { ndc, near, far, toFar, inverse } = this.scratch_;

    vec3.transformMat4(near, vec3.set(ndc, ndcX, ndcY, -1), inverse);
    vec3.transformMat4(far, vec3.set(ndc, ndcX, ndcY, 1), inverse);
    vec3.subtract(toFar, far, near);

    const w = this.w_;
    const nearDistance = near[w] - this.sliceValue_;
    const nearInFront = nearDistance >= 0;
    const farInFront = far[w] - this.sliceValue_ >= 0;

    const approachRate = toFar[w];
    if (
      approachRate * approachRate <
      MIN_APPROACH_COSINE_SQUARED * vec3.squaredLength(toFar)
    ) {
      return { hit: false, u: 0, v: 0, nearInFront, farInFront };
    }

    const t = -nearDistance / approachRate;
    if (t < 0) return { hit: false, u: 0, v: 0, nearInFront, farInFront };

    return {
      hit: true,
      u: near[this.u_] + t * toFar[this.u_],
      v: near[this.v_] + t * toFar[this.v_],
      nearInFront,
      farInFront,
    };
  }

  /**
   * Rows x, y, w of `viewProjection` restricted to the plane, mapping
   * homogeneous plane coordinates (u, v, 1) to clip (x, y, w). The z row drops
   * out because depth doesn't affect where a point lands on screen.
   */
  private planeToClipFor(viewProjection: mat4): mat3 {
    const { planeToClip } = this.scratch_;
    const m = viewProjection;
    const slice = this.sliceValue_;

    // where each axis's column starts, and the translation column
    const u = this.u_ * 4;
    const v = this.v_ * 4;
    const w = this.w_ * 4;
    const t = 3 * 4;

    // One column per line: the plane's two axes, then the point where the
    // slice crosses the third.
    // prettier-ignore
    mat3.set(planeToClip,
      m[u], m[u + 1], m[u + 3],
      m[v], m[v + 1], m[v + 3],
      m[w] * slice + m[t], m[w + 1] * slice + m[t + 1], m[w + 3] * slice + m[t + 3]
    );

    return planeToClip;
  }

  private cornerBounds(imageExtent: Box2): Box2 {
    const { cornerUV: c, boxMin, boxMax } = this.scratch_;

    let lowU = c[0];
    let lowV = c[1];
    let highU = c[0];
    let highV = c[1];
    for (let i = 1; i < 4; ++i) {
      const cu = c[i * 2];
      const cv = c[i * 2 + 1];
      if (cu < lowU) lowU = cu;
      if (cv < lowV) lowV = cv;
      if (cu > highU) highU = cu;
      if (cv > highV) highV = cv;
    }

    boxMin[0] = Math.max(lowU, imageExtent.min[0]);
    boxMin[1] = Math.max(lowV, imageExtent.min[1]);
    boxMax[0] = Math.min(highU, imageExtent.max[0]);
    boxMax[1] = Math.min(highV, imageExtent.max[1]);
    return new Box2(boxMin, boxMax);
  }

  private measureFootprints(
    viewProjection: mat4,
    bufferSizePx: { width: number; height: number }
  ): number[] {
    const planeToClip = this.planeToClipFor(viewProjection);
    const determinant = mat3.determinant(planeToClip);
    const pixelArea =
      (bufferSizePx.width / 2) *
      (bufferSizePx.height / 2) *
      Math.abs(determinant);

    // The adjugate is the inverse scaled by the determinant, so its bottom row
    // dotted with a screen position gives the reciprocal of the w there, which
    // is all the footprint needs. Where it reaches zero is the plane's horizon.
    const { adjugate } = this.scratch_;
    mat3.adjoint(adjugate, planeToClip);
    const bottomRow = [adjugate[2], adjugate[5], adjugate[8]];

    const footprints = new Array<number>(RAY_COUNT);

    let slot = 0;
    for (const ndcY of SAMPLE_NDC) {
      for (const ndcX of SAMPLE_NDC) {
        const w =
          determinant /
          (bottomRow[0] * ndcX + bottomRow[1] * ndcY + bottomRow[2]);

        // Infinity is a vote for the coarsest level
        footprints[slot++] =
          w > MIN_CLIP_W && pixelArea > 0
            ? Math.sqrt((w * w * w) / pixelArea)
            : Infinity;
      }
    }

    return footprints;
  }
}
