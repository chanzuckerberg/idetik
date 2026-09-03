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

export type PlaneView = {
  readonly worldViewRect: Box2;
  readonly footprint: PlaneFootprint;
};

/**
 * Samples where the slice plane lands on screen and how densely.
 *
 * Holds the working buffers rather than reallocating them: a view casts
 * thirteen rays per update, and allocating through each one cost more than the
 * arithmetic did. One sampler per view keeps that state owned and bounded.
 */
export class PlaneViewSampler {
  private readonly inverse_ = mat4.create();
  private readonly ndc_ = new Float32Array(3);
  private readonly clip_ = new Float32Array(4);
  private readonly near_ = new Float32Array(3);
  private readonly far_ = new Float32Array(3);
  private readonly toFar_ = new Float32Array(3);
  private readonly hitPoint_ = new Float32Array(2);
  private readonly cornerUV_ = new Float32Array(8);
  private readonly footprintMin_ = new Float64Array(9);
  private readonly footprintMax_ = new Float64Array(9);
  private readonly order_ = new Uint8Array(9);
  private readonly clipRows_ = new Float64Array(9);
  private readonly boxMin_ = vec2.create();
  private readonly boxMax_ = vec2.create();

  // in-plane and slice axis components, set per call
  private u_ = 0;
  private v_ = 1;
  private w_ = 2;
  private sliceValue_ = 0;

  // which side of the plane `intersect` found the frustum's ends on
  private nearInFront_ = false;
  private farInFront_ = false;

  /**
   * The rect never under-covers the data; it bounds a trapezoid in
   * perspective, and corners beyond the far plane still count since they only
   * clip the view. Returns an empty rect when nothing is visible, and the
   * image extent when the corners cannot be resolved.
   */
  public view(
    viewProjection: mat4,
    axes: SliceAxes,
    sliceValue: number | undefined,
    imageExtent: Box2,
    bufferSizePx: { width: number; height: number }
  ): PlaneView {
    if (sliceValue === undefined) {
      return { worldViewRect: imageExtent, footprint: COARSEST_FOOTPRINT };
    }
    if (!mat4.invert(this.inverse_, viewProjection)) {
      return { worldViewRect: imageExtent, footprint: COARSEST_FOOTPRINT };
    }

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
      return { worldViewRect: new Box2(), footprint: COARSEST_FOOTPRINT };
    }

    this.setClipRows(viewProjection);

    if (!allCornersHit) {
      return {
        worldViewRect: imageExtent,
        footprint: imageExtent.isEmpty()
          ? COARSEST_FOOTPRINT
          : this.medianFootprint(imageExtent, bufferSizePx),
      };
    }

    const worldViewRect = this.cornerBounds(imageExtent);
    if (worldViewRect.isEmpty()) {
      return { worldViewRect, footprint: COARSEST_FOOTPRINT };
    }

    return {
      worldViewRect,
      footprint: this.medianFootprint(worldViewRect, bufferSizePx),
    };
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
    out: Float32Array,
    ndcX: number,
    ndcY: number,
    ndcZ: number
  ): void {
    const m = this.inverse_;
    this.ndc_[0] = ndcX;
    this.ndc_[1] = ndcY;
    this.ndc_[2] = ndcZ;
    const x = this.ndc_[0];
    const y = this.ndc_[1];
    const z = this.ndc_[2];

    this.clip_[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
    this.clip_[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    this.clip_[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    this.clip_[3] = m[3] * x + m[7] * y + m[11] * z + m[15];

    const inverseW = 1 / this.clip_[3];
    out[0] = this.clip_[0] * inverseW;
    out[1] = this.clip_[1] * inverseW;
    out[2] = this.clip_[2] * inverseW;
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

  /**
   * Sampled on a grid in screen space rather than at one point in plane space.
   * The plane's world-space midpoint is dragged around by its most distant
   * corner, which recedes without bound as the plane tips towards edge-on; an
   * even spread across the viewport instead tracks what most of the screen
   * actually shows, and moves smoothly as the camera turns.
   *
   * Keep the grid odd and including 0: rows above the horizon contribute no
   * sample, and the median only survives that while under half the grid
   * misses. Whenever the plane is visible at all its horizon sits strictly
   * above ndcY 0, so a centre row that always hits caps the misses at one row
   * in three. An even split would forfeit that and let the horizon alone force
   * the coarsest level while most of the screen still showed usable data.
   */
  private medianFootprint(
    rect: Box2,
    bufferSizePx: { width: number; height: number }
  ): PlaneFootprint {
    const halfWidth = bufferSizePx.width / 2;
    const halfHeight = bufferSizePx.height / 2;
    const minU = rect.min[0];
    const minV = rect.min[1];
    const maxU = rect.max[0];
    const maxV = rect.max[1];

    let slot = 0;
    for (const ndcY of SAMPLE_NDC) {
      for (const ndcX of SAMPLE_NDC) {
        if (!this.intersect(ndcX, ndcY)) {
          // a ray past the horizon is a vote for the coarsest data rather
          // than a sample to discard
          this.footprintMin_[slot] = Infinity;
          this.footprintMax_[slot] = Infinity;
        } else {
          // samples off the data would report a footprint for chunks we are
          // not going to load
          const u = this.hitPoint_[0];
          const v = this.hitPoint_[1];
          this.setFootprint(
            slot,
            u < minU ? minU : u > maxU ? maxU : u,
            v < minV ? minV : v > maxV ? maxV : v,
            halfWidth,
            halfHeight
          );
        }
        ++slot;
      }
    }

    return this.selectMedian();
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
      this.footprintMin_[slot] = Infinity;
      this.footprintMax_[slot] = Infinity;
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

    this.footprintMin_[slot] = major > 0 ? 1 / major : Infinity;
    this.footprintMax_[slot] = minor > 0 ? 1 / minor : Infinity;
  }

  /** Median by the finer axis, ranking indices so the pair stays together. */
  private selectMedian(): PlaneFootprint {
    const order = this.order_;
    const mins = this.footprintMin_;
    for (let i = 0; i < 9; ++i) order[i] = i;
    for (let i = 1; i < 9; ++i) {
      const index = order[i];
      const key = mins[index];
      let j = i - 1;
      while (j >= 0 && mins[order[j]] > key) {
        order[j + 1] = order[j];
        --j;
      }
      order[j + 1] = index;
    }

    const median = order[4];
    return {
      minUnitsPerScreenPixel: mins[median],
      maxUnitsPerScreenPixel: this.footprintMax_[median],
    };
  }
}
