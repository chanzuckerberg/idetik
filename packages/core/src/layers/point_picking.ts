import { Chunk } from "../data/chunk";
import { EventContext } from "../core/event_dispatcher";
import { TrsTransform } from "../core/transforms";
import { vec2, vec3 } from "gl-matrix";

export interface PointPickingResult {
  world: vec3;
  value: number;
}

export function getValueAtWorld(
  worldPos: vec3,
  dataToWorld: TrsTransform,
  chunk: Chunk
): number | null {
  if (!chunk.data) return null;

  // Transform world to local texture coordinates using inverse transform
  const worldToData = dataToWorld.inverse;
  const localPos = vec3.transformMat4(vec3.create(), worldPos, worldToData);

  // Convert to pixel coordinates and bounds check
  const x = Math.floor(localPos[0]);
  const y = Math.floor(localPos[1]);
  if (x < 0 || x >= chunk.shape.x || y < 0 || y >= chunk.shape.y) {
    return null;
  }

  const pixelIndex = y * chunk.rowStride + x;
  const data = chunk.data;
  return data[pixelIndex];
}

export function handlePointPickingEvent<T>(
  event: EventContext,
  pointerDownPos: vec2 | null,
  getValueAtWorld: (world: vec3) => T | null,
  onPickValue?: (info: { world: vec3; value: T }) => void,
  dragThreshold: number = 3
): vec2 | null {
  switch (event.type) {
    case "pointerdown": {
      const e = event.event as PointerEvent;
      return vec2.fromValues(e.clientX, e.clientY);
    }

    case "pointerup": {
      if (!pointerDownPos) return pointerDownPos;

      const e = event.event as PointerEvent;
      const pointerUpPos = vec2.fromValues(e.clientX, e.clientY);
      const dist = vec2.distance(pointerDownPos, pointerUpPos);

      if (dist < dragThreshold) {
        if (!onPickValue) return null;

        const world = event.worldPos;
        if (world) {
          const value = getValueAtWorld(world);
          if (value !== null) {
            onPickValue({ world, value });
          }
        }
        return null;
      }
      return pointerDownPos;
    }

    case "pointercancel": {
      return null;
    }

    default:
      return pointerDownPos;
  }
}
