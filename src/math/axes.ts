import { mat3, quat, vec3 } from "gl-matrix";

export type SpatialAxis = "x" | "y" | "z";

export type SliceAxes = {
  u: SpatialAxis;
  v: SpatialAxis;
  w: SpatialAxis;
};

export const AxisComponent: Record<SpatialAxis, 0 | 1 | 2> = {
  x: 0,
  y: 1,
  z: 2,
};

/**
 * The plane a 2D slice lies on, named by its in-plane axes.
 */
export type SliceOrientation = "XY" | "XZ" | "YZ";

export function sliceAxesFor(orientation: SliceOrientation): SliceAxes {
  switch (orientation) {
    case "XY":
      return { u: "x", v: "y", w: "z" };
    case "XZ":
      return { u: "x", v: "z", w: "y" };
    case "YZ":
      return { u: "y", v: "z", w: "x" };
  }
}

export function orientationRotation(axes: SliceAxes): quat {
  const u = vec3.create();
  const v = vec3.create();

  u[AxisComponent[axes.u]] = 1;
  v[AxisComponent[axes.v]] = 1;

  const forward = vec3.cross(vec3.create(), u, v);

  // prettier-ignore
  const basis = mat3.fromValues(
    u[0], u[1], u[2],
    v[0], v[1], v[2],
    forward[0], forward[1], forward[2]
  );

  const rotation = quat.fromMat3(quat.create(), basis);

  return quat.normalize(rotation, rotation);
}
