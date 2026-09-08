import { mat4, vec3 } from "gl-matrix";

/**
 * Axis-aligned bounding box defined by minimum and maximum corners.
 *
 * Box3 represents a 3D region bounded by two corners: `min` and `max`. It
 * is used for spatial queries, culling tests, intersection checks, and
 * computing bounding volumes. A default-constructed box is empty and
 * intersection treats boxes as half-open intervals.
 *
 * @group Math
 */
export class Box3 {
  /** Minimum corner of the box. */
  public min: vec3;
  /** Maximum corner of the box. */
  public max: vec3;

  /**
   * Creates a box from optional corner points. The corners are cloned.
   * When a corner is omitted the box starts empty.
   *
   * @param min - The minimum corner.
   * @param max - The maximum corner.
   */
  constructor(min?: vec3, max?: vec3) {
    this.min = min
      ? vec3.clone(min)
      : vec3.fromValues(+Infinity, +Infinity, +Infinity);
    this.max = max
      ? vec3.clone(max)
      : vec3.fromValues(-Infinity, -Infinity, -Infinity);
  }

  /** Returns a deep copy of the box. */
  public clone() {
    return new Box3(this.min, this.max);
  }

  /** Returns `true` when the box encloses no volume. */
  public isEmpty(): boolean {
    return (
      this.max[0] <= this.min[0] ||
      this.max[1] <= this.min[1] ||
      this.max[2] <= this.min[2]
    );
  }

  /**
   * Tests whether two boxes overlap. Boxes are treated as half-open
   * intervals so touching faces do not count as overlap.
   *
   * @param a - The first box.
   * @param b - The second box.
   */
  public static intersects(a: Box3, b: Box3): boolean {
    if (a.max[0] <= b.min[0] || a.min[0] >= b.max[0]) return false;
    if (a.max[1] <= b.min[1] || a.min[1] >= b.max[1]) return false;
    if (a.max[2] <= b.min[2] || a.min[2] >= b.max[2]) return false;
    return true;
  }

  /**
   * Grows the box in place to contain the given point.
   *
   * @param p - The point to include.
   */
  public expandWithPoint(p: vec3) {
    if (p[0] < this.min[0]) this.min[0] = p[0];
    if (p[1] < this.min[1]) this.min[1] = p[1];
    if (p[2] < this.min[2]) this.min[2] = p[2];
    if (p[0] > this.max[0]) this.max[0] = p[0];
    if (p[1] > this.max[1]) this.max[1] = p[1];
    if (p[2] > this.max[2]) this.max[2] = p[2];
  }

  /**
   * Transforms the box in place by the given matrix. The result is the
   * axis-aligned box of the eight transformed corners so the box can grow
   * under rotation.
   *
   * @param matrix - The transform to apply.
   */
  public applyTransform(matrix: mat4) {
    const { min, max } = this;
    const corners: vec3[] = [
      vec3.fromValues(min[0], min[1], min[2]),
      vec3.fromValues(min[0], min[1], max[2]),
      vec3.fromValues(min[0], max[1], min[2]),
      vec3.fromValues(min[0], max[1], max[2]),
      vec3.fromValues(max[0], min[1], min[2]),
      vec3.fromValues(max[0], min[1], max[2]),
      vec3.fromValues(max[0], max[1], min[2]),
      vec3.fromValues(max[0], max[1], max[2]),
    ];

    // "Empty" box before expanding
    this.min = vec3.fromValues(+Infinity, +Infinity, +Infinity);
    this.max = vec3.fromValues(-Infinity, -Infinity, -Infinity);

    const tmp = vec3.create();
    for (const c of corners) {
      vec3.transformMat4(tmp, c, matrix);
      this.expandWithPoint(tmp);
    }
  }
}
