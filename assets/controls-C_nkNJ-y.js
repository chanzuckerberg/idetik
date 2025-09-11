import { d as create, n as clone, r as sub } from "./metadata_loaders-CXLkXwNR.js";
const LEFT_MOUSE_BUTTON = 0;
class PanZoomControls {
  camera_;
  dragActive_ = false;
  dragStart_ = create();
  constructor(camera) {
    this.camera_ = camera;
  }
  onEvent(event) {
    switch (event.type) {
      case "wheel":
        this.onWheel(event);
        break;
      case "pointerdown":
        this.onPointerDown(event);
        break;
      case "pointermove":
        this.onPointerMove(event);
        break;
      case "pointerup":
      case "pointercancel":
        this.onPointerEnd(event);
        break;
    }
  }
  onWheel(event) {
    if (!event.worldPos || !event.clipPos) return;
    const e = event.event;
    const posBeforeZoom = clone(event.worldPos);
    const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
    this.camera_.zoom(zoomFactor);
    const posAfterZoom = this.camera_.clipToWorld(event.clipPos);
    const delta = sub(create(), posBeforeZoom, posAfterZoom);
    this.camera_.pan(delta);
  }
  onPointerDown(event) {
    const e = event.event;
    if (!event.worldPos || e.button !== LEFT_MOUSE_BUTTON) return;
    this.dragStart_ = clone(event.worldPos);
    this.dragActive_ = true;
    e.target?.setPointerCapture?.(e.pointerId);
  }
  onPointerMove(event) {
    if (!this.dragActive_ || !event.worldPos) return;
    const delta = sub(create(), this.dragStart_, event.worldPos);
    this.camera_.pan(delta);
  }
  onPointerEnd(event) {
    const e = event.event;
    if (!this.dragActive_ || e.button !== LEFT_MOUSE_BUTTON) return;
    this.dragActive_ = false;
    e.target?.releasePointerCapture?.(e.pointerId);
  }
}
export {
  PanZoomControls as P
};
//# sourceMappingURL=controls-C_nkNJ-y.js.map
