import { vec3 } from "gl-matrix";
import { Plane } from "./plane";

// Below this rate the ray is treated as parallel to the plane
const MIN_APPROACH_RATE = 1e-12;

export class Ray {
  public readonly origin: vec3;
  public readonly direction: vec3;

  constructor(origin: vec3, direction: vec3) {
    this.origin = vec3.clone(origin);
    this.direction = vec3.normalize(vec3.create(), direction);
  }

  public intersectWithPlane(plane: Plane): vec3 | null {
    const approachRate = vec3.dot(this.direction, plane.normal);
    if (Math.abs(approachRate) < MIN_APPROACH_RATE) {
      return null;
    }

    const t = -plane.signedDistanceToPoint(this.origin) / approachRate;
    return vec3.scaleAndAdd(vec3.create(), this.origin, this.direction, t);
  }
}
