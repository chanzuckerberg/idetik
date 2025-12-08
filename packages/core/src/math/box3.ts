import { mat4, vec3 } from "gl-matrix";

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

  public expandWithPoint(p: vec3) {
    if (p[0] < this.min[0]) this.min[0] = p[0];
    if (p[1] < this.min[1]) this.min[1] = p[1];
    if (p[2] < this.min[2]) this.min[2] = p[2];
    if (p[0] > this.max[0]) this.max[0] = p[0];
    if (p[1] > this.max[1]) this.max[1] = p[1];
    if (p[2] > this.max[2]) this.max[2] = p[2];
  }

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

  public get size() {
    const size = vec3.create();
    vec3.subtract(size, this.max, this.min);
    return size;
  }
}
