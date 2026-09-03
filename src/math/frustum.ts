import { Plane } from "./plane";
import { Box3 } from "./box3";
import { mat4, vec3 } from "gl-matrix";

/**
 * Camera view frustum defined by six world-space planes.
 *
 * Frustum represents the visible region of a camera as six bounding
 * planes. It is used for culling tests and visibility checks against
 * bounding boxes. The planes are extracted from a view-projection matrix
 * and normalized so distances are in world units.
 *
 * @group Math
 */
export class Frustum {
  private readonly planes_: [Plane, Plane, Plane, Plane, Plane, Plane];

  /**
   * Creates a frustum from a view-projection matrix.
   *
   * @param m - The combined view-projection matrix.
   */
  constructor(m: mat4) {
    this.planes_ = [
      new Plane(vec3.create(), 0),
      new Plane(vec3.create(), 0),
      new Plane(vec3.create(), 0),
      new Plane(vec3.create(), 0),
      new Plane(vec3.create(), 0),
      new Plane(vec3.create(), 0),
    ];
    this.setWithViewProjection(m);
  }

  // Uses the fast plane-extraction algorithm described in
  // Gribb & Hartmann (1997): https://tinyurl.com/5x5htcwm
  /**
   * Re-extracts the six planes from a view-projection matrix.
   *
   * @param m - The combined view-projection matrix.
   */
  public setWithViewProjection(m: mat4) {
    const n = vec3.create();

    // Left: row3 + row0
    this.planes_[0].set(
      vec3.set(n, m[3] + m[0], m[7] + m[4], m[11] + m[8]),
      m[15] + m[12]
    );

    // Right: row3 - row0
    this.planes_[1].set(
      vec3.set(n, m[3] - m[0], m[7] - m[4], m[11] - m[8]),
      m[15] - m[12]
    );

    // Top: row3 - row1
    this.planes_[2].set(
      vec3.set(n, m[3] - m[1], m[7] - m[5], m[11] - m[9]),
      m[15] - m[13]
    );

    // Bottom: row3 + row1
    this.planes_[3].set(
      vec3.set(n, m[3] + m[1], m[7] + m[5], m[11] + m[9]),
      m[15] + m[13]
    );

    // Near: row3 + row2
    this.planes_[4].set(
      vec3.set(n, m[3] + m[2], m[7] + m[6], m[11] + m[10]),
      m[15] + m[14]
    );

    // Far: row3 - row2
    this.planes_[5].set(
      vec3.set(n, m[3] - m[2], m[7] - m[6], m[11] - m[10]),
      m[15] - m[14]
    );

    for (const p of this.planes_) p.normalize();
  }

  /**
   * Tests whether a box is at least partly inside the frustum. The test
   * is conservative. A box outside the frustum but near a corner can be
   * reported as intersecting, which only costs a draw of an offscreen
   * object.
   *
   * @param box - The world-space box to test.
   */
  public intersectsWithBox3(box: Box3) {
    const v = vec3.create();
    for (const plane of this.planes_) {
      const n = plane.normal;
      v[0] = n[0] > 0 ? box.max[0] : box.min[0];
      v[1] = n[1] > 0 ? box.max[1] : box.min[1];
      v[2] = n[2] > 0 ? box.max[2] : box.min[2];
      if (plane.signedDistanceToPoint(v) < 0) return false;
    }
    return true;
  }
}
