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
  const centerA = vec3.create();
  const centerB = vec3.create();

  objects.sort((a, b) => {
    vec3.add(centerA, a.boundingBox.max, a.boundingBox.min);
    vec3.scale(centerA, centerA, 0.5);
    vec3.add(centerB, b.boundingBox.max, b.boundingBox.min);
    vec3.scale(centerB, centerB, 0.5);

    const cam2aDistance = vec3.squaredDistance(cameraPosition, centerA);
    const cam2bDistance = vec3.squaredDistance(cameraPosition, centerB);

    return cam2aDistance - cam2bDistance;
  });

  return objects;
}
