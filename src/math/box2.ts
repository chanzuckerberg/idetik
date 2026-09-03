import { vec2 } from "gl-matrix";

/**
 * Axis-aligned bounding box defined by minimum and maximum corners.
 *
 * Box2 represents a 2D region bounded by two corners: `min` and `max`. It
 * is used for view rectangles, viewport regions, and intersection checks.
 * A default-constructed box is empty and intersection treats boxes
 * as half-open intervals.
 *
 * @group Math
 */
export class Box2 {
  /** Minimum corner of the box. */
  public min: vec2;
  /** Maximum corner of the box. */
  public max: vec2;

  /**
   * Creates a box from optional corner points. The corners are cloned.
   * When a corner is omitted the box starts empty.
   *
   * @param min - The minimum corner.
   * @param max - The maximum corner.
   */
  constructor(min?: vec2, max?: vec2) {
    this.min = min ? vec2.clone(min) : vec2.fromValues(+Infinity, +Infinity);
    this.max = max ? vec2.clone(max) : vec2.fromValues(-Infinity, -Infinity);
  }

  /** Returns a deep copy of the box. */
  public clone() {
    return new Box2(this.min, this.max);
  }

  /** Returns `true` when the box encloses no area. */
  public isEmpty(): boolean {
    return this.max[0] <= this.min[0] || this.max[1] <= this.min[1];
  }

  /**
   * Tests whether two boxes overlap. Boxes are treated as half-open
   * intervals so touching edges do not count as overlap.
   *
   * @param a - The first box.
   * @param b - The second box.
   */
  public static intersects(a: Box2, b: Box2): boolean {
    if (a.max[0] <= b.min[0] || a.min[0] >= b.max[0]) return false;
    if (a.max[1] <= b.min[1] || a.min[1] >= b.max[1]) return false;
    return true;
  }

  /**
   * Tests whether two boxes have exactly equal corners.
   *
   * @param a - The first box.
   * @param b - The second box.
   */
  public static equals(a: Box2, b: Box2): boolean {
    return vec2.exactEquals(a.min, b.min) && vec2.exactEquals(a.max, b.max);
  }

  /** Returns a copy with both corners floored componentwise. */
  public floor(): Box2 {
    return new Box2(
      vec2.fromValues(Math.floor(this.min[0]), Math.floor(this.min[1])),
      vec2.fromValues(Math.floor(this.max[0]), Math.floor(this.max[1]))
    );
  }

  /** Converts the box to an `x, y, width, height` rectangle. */
  public toRect(): { x: number; y: number; width: number; height: number } {
    const x = this.min[0];
    const y = this.min[1];
    const width = this.max[0] - this.min[0];
    const height = this.max[1] - this.min[1];
    return { x, y, width, height };
  }
}
