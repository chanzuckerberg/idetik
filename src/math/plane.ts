import { vec3 } from "gl-matrix";

// Below this rate a direction is treated as parallel to the plane
const MIN_APPROACH_RATE = 1e-12;

export class Plane {
  public normal: vec3;
  public signedDistance: number;

  constructor(normal: vec3 = vec3.fromValues(0, 1, 0), distance = 0) {
    this.normal = vec3.clone(normal);
    this.signedDistance = distance;
  }

  public static fromPointAndNormal(point: vec3, normal: vec3): Plane {
    return new Plane(normal, -vec3.dot(normal, point));
  }

  public set(normal: vec3, distance: number) {
    this.normal = vec3.clone(normal);
    this.signedDistance = distance;
  }

  public signedDistanceToPoint(point: vec3) {
    // Algebraic convention ax + by + cz + d = 0
    // Negative values mean the point lies opposite the plane's normal
    return vec3.dot(this.normal, point) + this.signedDistance;
  }

  public intersectionParameter(
    origin: vec3,
    displacement: vec3
  ): number | null {
    // return (`t`) is a fraction of `displacement` and is not bounded, so
    // `0 <= t <= 1` with non-normalized `displacement` means the segment crosses
    // the plane
    const approachRate = vec3.dot(displacement, this.normal);
    if (Math.abs(approachRate) < MIN_APPROACH_RATE) return null;
    return -this.signedDistanceToPoint(origin) / approachRate;
  }

  public normalize() {
    const len = vec3.length(this.normal);
    if (len > 0) {
      const inv = 1 / len;
      vec3.scale(this.normal, this.normal, inv);
      this.signedDistance *= inv;
    }
  }
}
