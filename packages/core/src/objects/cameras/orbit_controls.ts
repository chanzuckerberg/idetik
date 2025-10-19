import { CameraControls } from "./controls";
import { EventContext } from "../../core/event_dispatcher";
import { PerspectiveCamera } from "./perspective_camera";
import { Spherical } from "@/math/spherical";

import { vec3 } from "gl-matrix";

const MOUSE_BUTTON_NONE = -1;
const MOUSE_BUTTON_LEFT = 0;
const MOUSE_BUTTON_MIDDLE = 1;

const ORBIT_SPEED = 0.009;
const PAN_SPEED = 0.001;
const ZOOM_SPEED = 0.0009;

export class OrbitControls implements CameraControls {
  private readonly camera_: PerspectiveCamera;
  private readonly spherical_: Spherical;
  private readonly target_ = vec3.create();

  private currMouseButton_ = MOUSE_BUTTON_NONE;

  constructor(camera: PerspectiveCamera, radius = 1, yaw = 0, pitch = 0) {
    this.camera_ = camera;
    this.spherical_ = new Spherical(radius, yaw, pitch);
    this.update();
  }

  public onEvent(event: EventContext): void {
    switch (event.type) {
      case "pointerdown":
        this.onPointerDown(event);
        break;
      case "pointermove":
        this.onPointerMove(event);
        break;
      case "wheel":
        this.onWheel(event);
        break;
      case "pointerup":
      case "pointercancel":
        this.onPointerEnd(event);
        break;
    }
  }

  private onPointerDown(event: EventContext) {
    const e = event.event as PointerEvent;
    this.currMouseButton_ = e.button;

    (e.target as Element)?.setPointerCapture?.(e.pointerId);
  }

  private onPointerMove(event: EventContext) {
    if (this.currMouseButton_ == MOUSE_BUTTON_NONE) return;

    const e = event.event as PointerEvent;
    const dx = e.movementX ?? 0;
    const dy = e.movementY ?? 0;

    const m = e.shiftKey;
    const b = this.currMouseButton_;

    const doOrbit = b === MOUSE_BUTTON_LEFT && !m;
    const doPan = (b === MOUSE_BUTTON_LEFT && m) || b === MOUSE_BUTTON_MIDDLE;

    if (doOrbit) this.orbit(dx, dy);
    if (doPan) this.pan(dx, dy);

    this.update();
  }

  private onWheel(event: EventContext) {
    if (!event.worldPos || !event.clipPos) return;
    const e = event.event as WheelEvent;
    e.preventDefault(); // prevent the page from scrolling

    const dy = e.deltaY ?? 0;
    this.zoom(dy);

    this.update();
  }

  private onPointerEnd(event: EventContext) {
    this.currMouseButton_ = MOUSE_BUTTON_NONE;

    const e = event.event as PointerEvent;
    (e.target as Element)?.releasePointerCapture?.(e.pointerId);
  }

  private orbit(dx: number, dy: number) {
    this.spherical_.phi -= dx * ORBIT_SPEED;
    this.spherical_.theta += dy * ORBIT_SPEED;
    this.spherical_.makeSafe();
  }

  private pan(dx: number, dy: number) {
    // Scale pan speed by distance so movement feels consistent
    const speed = this.spherical_.radius * PAN_SPEED;
    const delta = vec3.create();

    vec3.scaleAndAdd(delta, delta, this.camera_.right, dx);
    vec3.scaleAndAdd(delta, delta, this.camera_.up, dy);
    vec3.scale(delta, delta, speed);

    vec3.sub(this.target_, this.target_, delta);
  }

  private zoom(dy: number) {
    // Exponential for smooth, distance-independent zoom
    const scale = Math.exp(dy * ZOOM_SPEED);
    this.spherical_.radius = Math.max(0.01, this.spherical_.radius * scale);
  }

  private update() {
    const p = vec3.add(vec3.create(), this.target_, this.spherical_.toVec3());
    this.camera_.transform.setTranslation(p);
    this.camera_.transform.targetTo(this.target_);
  }
}
