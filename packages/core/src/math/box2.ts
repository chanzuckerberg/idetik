import { vec2 } from "gl-matrix";
import { almostEqual } from "../utilities/almost_equal";

export class Box2 {
  public min: vec2;
  public max: vec2;

  /**
   * Initializes as an empty box if no values are provided using the
   * "empty-by-sentinel" pattern: min = +Infinity, max = -Infinity.
   * This allows expansion functions to work without special-casing
   * the first element, and avoids biasing toward (0,0).
   */
  constructor(min?: vec2, max?: vec2) {
    this.min = min ? vec2.clone(min) : vec2.fromValues(+Infinity, +Infinity);
    this.max = max ? vec2.clone(max) : vec2.fromValues(-Infinity, -Infinity);
  }

  public clone() {
    return new Box2(this.min, this.max);
  }

  public isEmpty(): boolean {
    return this.max[0] <= this.min[0] || this.max[1] <= this.min[1];
  }

  // Half-open interval intersection: returns true only if boxes overlap.
  public static intersects(a: Box2, b: Box2): boolean {
    if (a.max[0] <= b.min[0] || a.min[0] >= b.max[0]) return false;
    if (a.max[1] <= b.min[1] || a.min[1] >= b.max[1]) return false;
    return true;
  }

  public static equals(
    a: Box2,
    b: Box2,
    options: { absoluteTolerance?: number; relativeTolerance?: number } = {
      absoluteTolerance: 1e-6,
      relativeTolerance: 1e-9,
    }
  ): boolean {
    return (
      almostEqual(a.min[0], b.min[0], options) &&
      almostEqual(a.min[1], b.min[1], options) &&
      almostEqual(a.max[0], b.max[0], options) &&
      almostEqual(a.max[1], b.max[1], options)
    );
  }
}
