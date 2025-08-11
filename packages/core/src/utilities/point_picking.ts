import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";
import { Logger } from "./logger";

export function handlePointPickingEvent<T>(
  event: EventContext,
  pointerDownPos: vec2 | null,
  dragThreshold: number,
  getValueAtWorld: (world: vec3) => T | null,
  onPickValue?: (info: { world: vec3; value: T }) => void
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
        const world = event.worldPos;
        if (world) {
          const value = getValueAtWorld(world);
          if (value !== null) {
            if (onPickValue) {
              onPickValue({ world, value });
            } else {
              Logger.warn(
                "PointPicking",
                "Point picking attempted but no onPickValue callback provided"
              );
            }
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
