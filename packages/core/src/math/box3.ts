import { vec3 } from "gl-matrix";

export class Box3 {
  public min: vec3;
  public max: vec3;

  /**
   * Initializes as an empty box if no values are provided using the
   * "empty-by-sentinel" pattern: min = +Infinity, max = -Infinity.
   * This allows expansion functions to work without special-casing
   * the first element, and avoids biasing toward (0,0,0).
   */
  constructor(min?: vec3, max?: vec3) {
    this.min = min
      ? vec3.clone(min)
      : vec3.fromValues(+Infinity, +Infinity, +Infinity);
    this.max = max
      ? vec3.clone(max)
      : vec3.fromValues(-Infinity, -Infinity, -Infinity);
  }

  public clone() {
    return new Box3(this.min, this.max);
  }

  public isEmpty(): boolean {
    return (
      this.max[0] <= this.min[0] ||
      this.max[1] <= this.min[1] ||
      this.max[2] <= this.min[2]
    );
  }

  // Half-open interval intersection: returns true only if boxes overlap.
  public static intersects(a: Box3, b: Box3): boolean {
    if (a.max[0] <= b.min[0] || a.min[0] >= b.max[0]) return false;
    if (a.max[1] <= b.min[1] || a.min[1] >= b.max[1]) return false;
    if (a.max[2] <= b.min[2] || a.min[2] >= b.max[2]) return false;
    return true;
  }
}
