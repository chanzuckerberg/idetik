import { vec3 } from "gl-matrix";
import { Plane } from "./plane";

export class Ray {
  public readonly origin: vec3;
  public readonly direction: vec3;

  constructor(origin: vec3, direction: vec3) {
    this.origin = vec3.clone(origin);
    this.direction = vec3.normalize(vec3.create(), direction);
  }

  public intersectWithPlane(plane: Plane): vec3 | null {
    const t = plane.intersectionParameter(this.origin, this.direction);
    if (t === null) return null;
    return vec3.scaleAndAdd(vec3.create(), this.origin, this.direction, t);
  }
}
