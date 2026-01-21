import { vec3, quat } from "gl-matrix";
import type { Chunk, SourceDimensionMap, SourceDimension } from "./chunk";

export type SliceCoordinatesXY = {
  orientation: "xy";
  z: number;
  t?: number;
  c?: number;
};

export type SliceCoordinatesXZ = {
  orientation: "xz";
  y: number;
  t?: number;
  c?: number;
};

export type SliceCoordinatesYZ = {
  orientation: "yz";
  x: number;
  t?: number;
  c?: number;
};

export type SliceCoordinatesVolume = {
  orientation: "volume";
  t?: number;
  c?: number;
};

export type SliceCoordinates =
  | SliceCoordinatesXY
  | SliceCoordinatesXZ
  | SliceCoordinatesYZ
  | SliceCoordinatesVolume;

export function isAxisAlignedSlice(
  coords: SliceCoordinates
): coords is SliceCoordinatesXY | SliceCoordinatesXZ | SliceCoordinatesYZ {
  return (
    coords.orientation === "xy" ||
    coords.orientation === "xz" ||
    coords.orientation === "yz"
  );
}

export function getSlicePosition(coords: SliceCoordinates): number | undefined {
  switch (coords.orientation) {
    case "xy":
      return coords.z;
    case "xz":
      return coords.y;
    case "yz":
      return coords.x;
    case "volume":
      return undefined;
  }
}

export type SlicePlane = {
  normal: vec3;
  origin: vec3;
};

export function getSlicePlane(
  coords: SliceCoordinates
): SlicePlane | undefined {
  switch (coords.orientation) {
    case "xy":
      return {
        normal: vec3.fromValues(0, 0, 1),
        origin: vec3.fromValues(0, 0, coords.z),
      };
    case "xz":
      return {
        normal: vec3.fromValues(0, 1, 0),
        origin: vec3.fromValues(0, coords.y, 0),
      };
    case "yz":
      return {
        normal: vec3.fromValues(1, 0, 0),
        origin: vec3.fromValues(coords.x, 0, 0),
      };
    case "volume":
      return undefined;
  }
}

export function projectPointOntoPlane(point: vec3, plane: SlicePlane): vec3 {
  const toPoint = vec3.create();
  vec3.subtract(toPoint, point, plane.origin);
  const distance = vec3.dot(toPoint, plane.normal);
  const projected = vec3.create();
  vec3.scaleAndAdd(projected, point, plane.normal, -distance);
  return projected;
}

function getSliceAxis(orientation: "xy" | "xz" | "yz"): "x" | "y" | "z" {
  switch (orientation) {
    case "xy":
      return "z";
    case "xz":
      return "y";
    case "yz":
      return "x";
  }
}

export function chunkIntersectsSlice(
  chunk: Chunk,
  orientation: "xy" | "xz" | "yz",
  slicePosition: number
): boolean {
  const axis = getSliceAxis(orientation);
  return (
    chunk.offset[axis] <= slicePosition &&
    slicePosition <= chunk.offset[axis] + chunk.shape[axis] * chunk.scale[axis]
  );
}

export function getHorizontalDimension(
  dimensions: SourceDimensionMap,
  orientation: "xy" | "xz" | "yz"
): SourceDimension {
  switch (orientation) {
    case "xy":
    case "xz":
      return dimensions.x;
    case "yz":
      return dimensions.y;
  }
}

export function getSlicedDimension(
  dimensions: SourceDimensionMap,
  orientation: "xy" | "xz" | "yz"
): SourceDimension | undefined {
  switch (orientation) {
    case "xy":
      return dimensions.z;
    case "xz":
      return dimensions.y;
    case "yz":
      return dimensions.x;
  }
}

export function getTextureDimensions(
  chunk: Chunk,
  orientation: "xy" | "xz" | "yz"
): { width: number; height: number } {
  switch (orientation) {
    case "xy":
      return { width: chunk.shape.x, height: chunk.shape.y };
    case "xz":
      return { width: chunk.shape.x, height: chunk.shape.z };
    case "yz":
      return { width: chunk.shape.z, height: chunk.shape.y };
  }
}

export function getSliceScale(
  chunk: Chunk,
  orientation: "xy" | "xz" | "yz"
): vec3 {
  switch (orientation) {
    case "xy":
      return vec3.fromValues(chunk.scale.x, chunk.scale.y, 1);
    case "xz":
      return vec3.fromValues(chunk.scale.x, chunk.scale.z, 1);
    case "yz":
      return vec3.fromValues(chunk.scale.z, chunk.scale.y, 1);
  }
}

export function getSliceTranslation(
  chunk: Chunk,
  orientation: "xy" | "xz" | "yz",
  slicePosition: number
): vec3 {
  switch (orientation) {
    case "xy":
      return vec3.fromValues(chunk.offset.x, chunk.offset.y, slicePosition);
    case "xz":
      return vec3.fromValues(chunk.offset.x, slicePosition, chunk.offset.z);
    case "yz":
      return vec3.fromValues(slicePosition, chunk.offset.y, chunk.offset.z);
  }
}

export function getSliceRotation(orientation: "xy" | "xz" | "yz"): quat {
  const rotation = quat.create();
  switch (orientation) {
    case "xy":
      return rotation;
    case "xz":
      quat.rotateX(rotation, rotation, Math.PI / 2);
      return rotation;
    case "yz":
      quat.rotateY(rotation, rotation, -Math.PI / 2);
      return rotation;
  }
}
