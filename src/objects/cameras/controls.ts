import { vec3 } from "gl-matrix";
import { OrthographicCamera } from "./orthographic_camera";
import { EventContext } from "../../core/event_dispatcher";

const LEFT_MOUSE_BUTTON = 0;

export interface CameraControls {
  readonly isMoving: boolean;
  onUpdate(dt: number): void;
  onEvent(event: EventContext): void;
}

export class PanZoomControls implements CameraControls {
  private readonly camera_: OrthographicCamera;
  private dragActive_ = false;
  private dragStart_: vec3 = vec3.create();

  constructor(camera: OrthographicCamera) {
    this.camera_ = camera;
  }

  public get isMoving(): boolean {
    return this.dragActive_;
  }

  public onEvent(event: EventContext): void {
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

  public onUpdate(_delta: number) {}

  private onWheel(event: EventContext) {
    if (!event.worldPos || !event.clipPos) return;
    const e = event.event as WheelEvent;

    // Prevent the page from scrolling, the default action for wheel events.
    e.preventDefault();

    const posBeforeZoom = vec3.clone(event.worldPos);
    const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;

    this.camera_.zoom(zoomFactor);

    const posAfterZoom = this.camera_.clipToWorld(event.clipPos);
    const delta = vec3.sub(vec3.create(), posBeforeZoom, posAfterZoom);
    this.camera_.pan(delta);
  }

  private onPointerDown(event: EventContext) {
    const e = event.event as PointerEvent;
    if (!event.worldPos || e.button !== LEFT_MOUSE_BUTTON) return;

    this.dragStart_ = vec3.clone(event.worldPos);
    this.dragActive_ = true;

    (e.target as Element)?.setPointerCapture?.(e.pointerId);
  }

  private onPointerMove(event: EventContext) {
    if (!this.dragActive_ || !event.worldPos) return;

    const delta = vec3.sub(vec3.create(), this.dragStart_, event.worldPos);
    this.camera_.pan(delta);
  }

  private onPointerEnd(event: EventContext) {
    const e = event.event as PointerEvent;
    if (!this.dragActive_ || e.button !== LEFT_MOUSE_BUTTON) return;

    this.dragActive_ = false;

    (e.target as Element)?.releasePointerCapture?.(e.pointerId);
  }
}
