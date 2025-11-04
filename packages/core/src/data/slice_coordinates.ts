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

export type SliceCoordinatesOblique = {
  orientation: "oblique";
  // TODO: define oblique slice parameters (plane equation, normal vector, etc.)
  t?: number;
  c?: number;
};

export type SliceCoordinates =
  | SliceCoordinatesXY
  | SliceCoordinatesXZ
  | SliceCoordinatesYZ
  | SliceCoordinatesVolume
  | SliceCoordinatesOblique;

/**
 * Type guard to check if slice coordinates are axis-aligned (not volume or oblique).
 */
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
    case "oblique":
      return undefined;
  }
}

/**
 * Get texture dimensions for a chunk based on orientation.
 * Returns the width and height for creating a 2D texture from the chunk data.
 */
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

/**
 * Get the sliced axis name based on orientation.
 * Returns which dimension is being sliced through.
 * Internal helper - not exported.
 */
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

/**
 * Check if a chunk intersects with a slice position along the slice axis.
 */
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

/**
 * Get the horizontal (screen space) dimension for an orientation.
 * This is used for LOD calculations based on screen pixel density.
 */
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

/**
 * Get the source dimension being sliced for a given orientation.
 */
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

/**
 * Get the scale vector for positioning a slice renderable.
 */
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

/**
 * Get the translation vector for positioning a slice renderable.
 */
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

/**
 * Get the rotation quaternion for positioning a slice renderable.
 */
export function getSliceRotation(orientation: "xy" | "xz" | "yz"): quat {
  const rotation = quat.create();
  switch (orientation) {
    case "xy":
      return rotation; // Identity rotation
    case "xz":
      quat.rotateX(rotation, rotation, Math.PI / 2);
      return rotation;
    case "yz":
      quat.rotateY(rotation, rotation, -Math.PI / 2);
      return rotation;
  }
}
