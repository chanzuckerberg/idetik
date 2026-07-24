import { EventContext } from "../core/event_dispatcher";
import { Ray } from "../math/ray";
import { Logger } from "../utilities/logger";
import { vec2, vec3 } from "gl-matrix";

export interface PointPickingResult {
  world: vec3;
  value: number;
}

export function handlePointPickingEvent<T>(
  event: EventContext,
  pointerDownPos: vec2 | null,
  pickAtRay: (ray: Ray) => Promise<{ world: vec3; value: T } | null>,
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

        const ray = event.worldRay;
        if (ray) {
          pickAtRay(ray)
            .then((info) => {
              if (info !== null) {
                onPickValue(info);
              }
            })
            .catch((error) => {
              Logger.error("PointPicking", `Failed to read value: ${error}`);
            });
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
