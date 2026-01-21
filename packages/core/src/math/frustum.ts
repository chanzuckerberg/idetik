import { Plane } from "./plane";
import { Box3 } from "./box3";
import { mat4, vec3 } from "gl-matrix";

export class Frustum {
  private readonly planes_: [Plane, Plane, Plane, Plane, Plane, Plane];

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

  public getWidth(): number {
    // For parallel planes with opposite normals (left points right, right points left),
    // the distance is the absolute value of the sum of their signed distances
    const left = this.planes_[0];
    const right = this.planes_[1];

    // Take a point on the left plane and measure distance to right plane
    // Point on left plane: any point where left.normal · p + left.signedDistance = 0
    // We can use a point along the normal direction: p = -left.signedDistance * left.normal
    const pointOnLeft = vec3.scale(
      vec3.create(),
      left.normal,
      -left.signedDistance
    );
    return Math.abs(right.signedDistanceToPoint(pointOnLeft));
  }
}
