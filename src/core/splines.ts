import { vec3 } from "gl-matrix";

type BezierParams = {
  path: vec3[];
  n: number;
  x?: number[];
  fac?: number;
};

export function cubicHermiteInterpolation(params: BezierParams): vec3[] {
  const { path, n } = params;
  let { x, fac } = params;
  if (!x) {
    x = new Array(path.length).fill(0).map((_, i) => i);
  }
  if (!fac) {
    fac = 1.0 / 3.0;
  }
  const tangents = pathTangents(path, x);

  const out = Array((path.length - 1) * n);

  // a cubic bezier curve is defined by 4 control points: a, b, c, d
  // for interpolation of a segment:
  // * a and d are the endpoints of the curve segment
  // * b and c are control points that define curvature
  // here we use 1/3 of the tangent at each endpoint as the control points
  // this is equivalent to a cubic Hermite spline
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const d = path[i + 1];
    const b = vec3.clone(tangents[i]);
    vec3.scaleAndAdd(b, a, b, fac);
    const c = vec3.clone(tangents[i + 1]);
    vec3.scaleAndAdd(c, d, c, -fac);
    for (let t = 0; t < n; t++) {
      const o = (out[i * n + t] = vec3.create());
      vec3.bezier(o, a, b, c, d, t / n);
    }
  }

  return out;
}

function pathTangents(path: vec3[], x: number[]): vec3[] {
  if (path.length < 2) {
    throw new Error("Path must contain at least 2 points");
  }

  const tangents: vec3[] = Array(path.length);
  for (let i = 0; i < path.length; i++) {
    const prev = path[i - 1] ?? path[i];
    const curr = path[i];
    const next = path[i + 1] ?? path[i];
    const prevX = x[i - 1] ?? x[i];
    const currX = x[i];
    const nextX = x[i + 1] ?? x[i];

    const m0 = vec3.create();
    const m1 = vec3.create();
    tangents[i] = vec3.create();

    if (i !== 0) {
      vec3.sub(m0, curr, prev);
      vec3.scale(m0, m0, 1.0 / (currX - prevX));
    }

    if (i !== path.length - 1) {
      vec3.sub(m1, next, curr);
      vec3.scale(m1, m1, 1.0 / (nextX - currX));
    }

    if (i === 0) {
      vec3.copy(tangents[i], m1);
    } else if (i == path.length - 1) {
      vec3.copy(tangents[i], m0);
    } else {
      vec3.add(tangents[i], m0, m1);
      vec3.scale(tangents[i], tangents[i], 0.5);
    }
  }

  return tangents;
}
