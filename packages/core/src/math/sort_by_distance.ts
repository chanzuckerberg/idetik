import { vec3 } from "gl-matrix";
import type { Camera } from "../objects/cameras/camera";
import type { RenderableObject } from "../core/renderable_object";

/**
 * Sorts objects front-to-back based on their distance from a camera
 *
 * Uses the camera position compared to the center of each object's
 * bounding box to determine distance.
 * @param objects - Array of renderable objects to sort.
 * @param camera - The camera to calculate distances from
 * @returns Input objects sorted-in-place from closest to farthest
 */
export function sortFrontToBack(
  objects: RenderableObject[],
  camera: Camera
): RenderableObject[] {
  const cameraPosition = camera.position;

  // Pre-compute bounding box centers to avoid repeated allocations during sort
  const centers = new Map<RenderableObject, vec3>();
  for (const obj of objects) {
    const bbox = obj.boundingBox;
    const center = vec3.create();
    vec3.add(center, bbox.max, bbox.min);
    vec3.scale(center, center, 0.5);
    centers.set(obj, center);
  }

  objects.sort((a, b) => {
    const cam2aDistance = vec3.squaredDistance(cameraPosition, centers.get(a)!);
    const cam2bDistance = vec3.squaredDistance(cameraPosition, centers.get(b)!);

    return cam2aDistance - cam2bDistance;
  });

  return objects;
}
