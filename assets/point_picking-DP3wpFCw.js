import { h as fromValues, i as distance } from "./metadata_loaders-CXLkXwNR.js";
function handlePointPickingEvent(event, pointerDownPos, getValueAtWorld, onPickValue, dragThreshold = 3) {
  switch (event.type) {
    case "pointerdown": {
      const e = event.event;
      return fromValues(e.clientX, e.clientY);
    }
    case "pointerup": {
      if (!pointerDownPos) return pointerDownPos;
      const e = event.event;
      const pointerUpPos = fromValues(e.clientX, e.clientY);
      const dist = distance(pointerDownPos, pointerUpPos);
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
export {
  handlePointPickingEvent as h
};
//# sourceMappingURL=point_picking-DP3wpFCw.js.map
