import { CameraControls } from "./controls";
import { EventContext } from "../../core/event_dispatcher";
import { PerspectiveCamera } from "./perspective_camera";
import { Spherical } from "../../math/spherical";

import { glMatrix, vec3 } from "gl-matrix";
import { clamp } from "../../utilities/clamp";

const MOUSE_BUTTON_NONE = -1;
const MOUSE_BUTTON_LEFT = 0;
const MOUSE_BUTTON_MIDDLE = 1;

const ORBIT_SPEED = 0.009;
const PAN_SPEED = 0.001;
const ZOOM_SPEED = 0.0009;

export class OrbitControls implements CameraControls {
  private readonly camera_: PerspectiveCamera;
  private readonly sphericalPos_: Spherical;
  private readonly target_ = vec3.create();

  private currMouseButton_ = MOUSE_BUTTON_NONE;

  constructor(camera: PerspectiveCamera, radius = 1, yaw = 0, pitch = 0) {
    this.camera_ = camera;
    this.sphericalPos_ = new Spherical(radius, yaw, pitch);
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

    const doOrbit = this.currMouseButton_ === MOUSE_BUTTON_LEFT && !e.shiftKey;
    const doPan =
      (this.currMouseButton_ === MOUSE_BUTTON_LEFT && e.shiftKey) ||
      this.currMouseButton_ === MOUSE_BUTTON_MIDDLE;

    if (doOrbit) this.orbit(dx, dy);
    if (doPan) this.pan(dx, dy);

    this.update();
  }

  private onWheel(event: EventContext) {
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
    this.sphericalPos_.phi -= dx * ORBIT_SPEED;
    this.sphericalPos_.theta += dy * ORBIT_SPEED;

    // Prevent the camera from reaching the poles (±π/2), where
    // the view direction would flip and orbit controls would invert.
    // We clamp the elevation angle slightly before ±π/2 to maintain
    // stable rotation and avoid gimbal-like artifacts.
    const limit = Math.PI / 2 - glMatrix.EPSILON;
    this.sphericalPos_.theta = clamp(this.sphericalPos_.theta, -limit, limit);
  }

  private pan(dx: number, dy: number) {
    // Scale pan speed by distance so movement feels consistent
    const speed = this.sphericalPos_.radius * PAN_SPEED;
    const delta = vec3.create();

    vec3.scaleAndAdd(delta, delta, this.camera_.right, dx);
    vec3.scaleAndAdd(delta, delta, this.camera_.up, dy);
    vec3.scale(delta, delta, speed);

    vec3.sub(this.target_, this.target_, delta);
  }

  private zoom(dy: number) {
    // Exponential for smooth, distance-independent zoom
    const scale = Math.exp(dy * ZOOM_SPEED);
    this.sphericalPos_.radius = Math.max(
      0.01,
      this.sphericalPos_.radius * scale
    );
  }

  private update() {
    const p = vec3.add(
      vec3.create(),
      this.target_,
      this.sphericalPos_.toVec3()
    );
    this.camera_.transform.setTranslation(p);
    this.camera_.transform.targetTo(this.target_);
  }
}
