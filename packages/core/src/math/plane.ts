import { vec3 } from "gl-matrix";

export class Plane {
  public normal: vec3;
  public signedDistance: number;

  constructor(normal: vec3 = vec3.fromValues(0, 1, 0), distance = 0) {
    this.normal = vec3.clone(normal);
    this.signedDistance = distance;
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

  public normalize() {
    const len = vec3.length(this.normal);
    if (len > 0) {
      const inv = 1 / len;
      vec3.scale(this.normal, this.normal, inv);
      this.signedDistance *= inv;
    }
  }
}
