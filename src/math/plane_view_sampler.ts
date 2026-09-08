import { mat4, vec2 } from "gl-matrix";
import { AxisComponent, SliceAxes } from "./axes";
import { Box2 } from "./box2";

// At or below this clip w the sample point sits on or behind the eye
const MIN_CLIP_W = 1e-9;

// Below this cosine between the frustum segment and the plane's normal the
// two are parallel. The near and far points are unprojected through a float32
// matrix, so roughly seven digits survive and anything under ~1e-7 is noise.
// Compared squared to keep a square root out of the per-ray path.
const MIN_APPROACH_COSINE_SQUARED = 1e-6 * 1e-6;

const SAMPLE_NDC = [-2 / 3, 0, 2 / 3];
const CORNER_NDC_X = [-1, 1, -1, 1];
const CORNER_NDC_Y = [-1, -1, 1, 1];

const RAY_COUNT = 9;

/**
 * Plane units one screen pixel covers at a ray, along the ray's least and most
 * magnified directions. Both are Infinity where the ray met no plane.
 */
export type PlaneView = {
  readonly worldViewRect: Box2;
  /** One entry per ray, valid only until the next `view` call. */
  readonly rays: readonly RayFootprint[];
};

export type RayFootprint = {
  readonly narrow: number;
  readonly wide: number;
};

export class PlaneViewSampler {
  private readonly inverse_ = mat4.create();
  private readonly near_ = new Float64Array(3);
  private readonly far_ = new Float64Array(3);
  private readonly toFar_ = new Float64Array(3);
  private readonly hitPoint_ = new Float64Array(2);
  private readonly cornerUV_ = new Float64Array(8);
  private readonly rays_ = Array.from({ length: RAY_COUNT }, () => ({
    narrow: Infinity,
    wide: Infinity,
  }));
  private readonly clipRows_ = new Float64Array(9);
  private readonly boxMin_ = vec2.create();
  private readonly boxMax_ = vec2.create();

  private u_ = 0;
  private v_ = 1;
  private w_ = 2;
  private sliceValue_ = 0;

  private nearInFront_ = false;
  private farInFront_ = false;

  /**
   * Fills the per-ray footprints and returns the plane's visible rect, which
   * never under-covers the data: it bounds a trapezoid in perspective, and
   * corners past the far plane still count since they only clip the view.
   */
  public view(
    viewProjection: mat4,
    axes: SliceAxes,
    sliceValue: number | undefined,
    imageExtent: Box2,
    bufferSizePx: { width: number; height: number }
  ): PlaneView {
    for (const ray of this.rays_) {
      ray.narrow = Infinity;
      ray.wide = Infinity;
    }

    if (sliceValue === undefined)
      return { worldViewRect: imageExtent, rays: this.rays_ };
    if (!mat4.invert(this.inverse_, viewProjection))
      return { worldViewRect: imageExtent, rays: this.rays_ };

    this.u_ = AxisComponent[axes.u];
    this.v_ = AxisComponent[axes.v];
    this.w_ = AxisComponent[axes.w];
    this.sliceValue_ = sliceValue;

    let anyInFront = false;
    let anyBehind = false;
    let allCornersHit = true;

    for (let i = 0; i < 4; ++i) {
      const hit = this.intersect(CORNER_NDC_X[i], CORNER_NDC_Y[i]);
      if (this.nearInFront_ || this.farInFront_) anyInFront = true;
      if (!this.nearInFront_ || !this.farInFront_) anyBehind = true;
      if (!hit) allCornersHit = false;
      this.cornerUV_[i * 2] = this.hitPoint_[0];
      this.cornerUV_[i * 2 + 1] = this.hitPoint_[1];
    }

    if (!anyInFront || !anyBehind) {
      return { worldViewRect: new Box2(), rays: this.rays_ };
    }

    this.setClipRows(viewProjection);

    const worldViewRect = allCornersHit
      ? this.cornerBounds(imageExtent)
      : imageExtent;
    if (!worldViewRect.isEmpty()) this.measureFootprints(bufferSizePx);
    return { worldViewRect, rays: this.rays_ };
  }

  /**
   * Intersects the ray through an NDC position with the plane, leaving the
   * result in `hitPoint_` and the frustum's sides in `nearInFront_` /
   * `farInFront_`. The plane's normal is always a unit basis vector, so its
   * signed distance and approach rate are component reads, not dot products.
   */
  private intersect(ndcX: number, ndcY: number): boolean {
    this.unproject(this.near_, ndcX, ndcY, -1);
    this.unproject(this.far_, ndcX, ndcY, 1);

    const w = this.w_;
    const nearDistance = this.near_[w] - this.sliceValue_;
    this.nearInFront_ = nearDistance >= 0;
    this.farInFront_ = this.far_[w] - this.sliceValue_ >= 0;

    this.toFar_[0] = this.far_[0] - this.near_[0];
    this.toFar_[1] = this.far_[1] - this.near_[1];
    this.toFar_[2] = this.far_[2] - this.near_[2];

    const approachRate = this.toFar_[w];
    const lengthSquared =
      this.toFar_[0] * this.toFar_[0] +
      this.toFar_[1] * this.toFar_[1] +
      this.toFar_[2] * this.toFar_[2];
    if (
      approachRate * approachRate <
      MIN_APPROACH_COSINE_SQUARED * lengthSquared
    ) {
      return false;
    }

    const t = -nearDistance / approachRate;
    if (t < 0) return false;

    this.hitPoint_[0] = this.near_[this.u_] + t * this.toFar_[this.u_];
    this.hitPoint_[1] = this.near_[this.v_] + t * this.toFar_[this.v_];
    return true;
  }

  private unproject(
    out: Float64Array,
    ndcX: number,
    ndcY: number,
    ndcZ: number
  ): void {
    const m = this.inverse_;
    const x = m[0] * ndcX + m[4] * ndcY + m[8] * ndcZ + m[12];
    const y = m[1] * ndcX + m[5] * ndcY + m[9] * ndcZ + m[13];
    const z = m[2] * ndcX + m[6] * ndcY + m[10] * ndcZ + m[14];
    const w = m[3] * ndcX + m[7] * ndcY + m[11] * ndcZ + m[15];

    const inverseW = 1 / w;
    out[0] = x * inverseW;
    out[1] = y * inverseW;
    out[2] = z * inverseW;
  }

  /**
   * Rows x, y, w of `viewProjection` restricted to the plane, mapping
   * homogeneous plane coordinates (u, v, 1) to clip (x, y, w). The z row drops
   * out because depth doesn't affect where a point lands on screen.
   */
  private setClipRows(viewProjection: mat4): void {
    const m = viewProjection;
    const h = this.clipRows_;
    const u = this.u_ * 4;
    const v = this.v_ * 4;
    const w = this.w_ * 4;
    const t = 12;
    const slice = this.sliceValue_;

    h[0] = m[u];
    h[1] = m[v];
    h[2] = m[w] * slice + m[t];
    h[3] = m[u + 1];
    h[4] = m[v + 1];
    h[5] = m[w + 1] * slice + m[t + 1];
    h[6] = m[u + 3];
    h[7] = m[v + 3];
    h[8] = m[w + 3] * slice + m[t + 3];
  }

  private cornerBounds(imageExtent: Box2): Box2 {
    const c = this.cornerUV_;
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

    this.boxMin_[0] = Math.max(lowU, imageExtent.min[0]);
    this.boxMin_[1] = Math.max(lowV, imageExtent.min[1]);
    this.boxMax_[0] = Math.min(highU, imageExtent.max[0]);
    this.boxMax_[1] = Math.min(highV, imageExtent.max[1]);
    return new Box2(this.boxMin_, this.boxMax_);
  }

  private measureFootprints(bufferSizePx: {
    width: number;
    height: number;
  }): void {
    const halfWidth = bufferSizePx.width / 2;
    const halfHeight = bufferSizePx.height / 2;

    let slot = 0;
    for (const ndcY of SAMPLE_NDC) {
      for (const ndcX of SAMPLE_NDC) {
        if (!this.intersect(ndcX, ndcY)) {
          // a ray past the horizon is a vote for the coarsest LOD
          this.rays_[slot].narrow = Infinity;
          this.rays_[slot].wide = Infinity;
        } else {
          this.setFootprint(
            slot,
            this.hitPoint_[0],
            this.hitPoint_[1],
            halfWidth,
            halfHeight
          );
        }
        ++slot;
      }
    }
  }

  /**
   * The plane-to-screen map is projective, so its derivative varies across the
   * plane and has to be evaluated somewhere specific. The singular values of
   * the Jacobian there are the extremes of the pixel footprint.
   */
  private setFootprint(
    slot: number,
    u: number,
    v: number,
    halfWidth: number,
    halfHeight: number
  ): void {
    const h = this.clipRows_;
    const x = h[0] * u + h[1] * v + h[2];
    const y = h[3] * u + h[4] * v + h[5];
    const w = h[6] * u + h[7] * v + h[8];
    if (!(w > MIN_CLIP_W) || !Number.isFinite(x) || !Number.isFinite(y)) {
      this.rays_[slot].narrow = Infinity;
      this.rays_[slot].wide = Infinity;
      return;
    }

    // d(ndc)/d(u, v) by the quotient rule, scaled from ndc to pixels
    const inverseWSquared = 1 / (w * w);
    const a = halfWidth * (h[0] * w - x * h[6]) * inverseWSquared;
    const b = halfWidth * (h[1] * w - x * h[7]) * inverseWSquared;
    const c = halfHeight * (h[3] * w - y * h[6]) * inverseWSquared;
    const d = halfHeight * (h[4] * w - y * h[7]) * inverseWSquared;

    const mean = (a * a + b * b + c * c + d * d) / 2;
    const spread = Math.hypot(
      (a * a + b * b - c * c - d * d) / 2,
      a * c + b * d
    );
    const major = Math.sqrt(Math.max(0, mean + spread));
    const minor = Math.sqrt(Math.max(0, mean - spread));

    this.rays_[slot].narrow = major > 0 ? 1 / major : Infinity;
    this.rays_[slot].wide = minor > 0 ? 1 / minor : Infinity;
  }
}
