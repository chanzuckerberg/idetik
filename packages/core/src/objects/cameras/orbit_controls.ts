import { CameraControls } from "./controls";
import { EventContext } from "../../core/event_dispatcher";
import { PerspectiveCamera } from "./perspective_camera";
import { Spherical } from "../../math/spherical";

import { glMatrix, vec3 } from "gl-matrix";
import { clamp } from "../../utilities/clamp";
import { lerp } from "../../utilities/lerp";

const MOUSE_BUTTON_NONE = -1;
const MOUSE_BUTTON_LEFT = 0;
const MOUSE_BUTTON_MIDDLE = 1;

const ORBIT_SPEED = 0.009;
const PAN_SPEED = 0.001;
const ZOOM_SPEED = 0.0009;
const DEFAULT_DAMPING_FACTOR = 3;

type OrbitParams = {
  radius?: number;
  yaw?: number;
  pitch?: number;
  dampingFactor?: number;
};

export class OrbitControls implements CameraControls {
  private readonly camera_: PerspectiveCamera;

  private readonly targetPos_: Spherical;
  private readonly targetCenter_ = vec3.create();

  private readonly currPos_: Spherical;
  private readonly currCenter_ = vec3.create();

  private readonly dampingFactor_: number;

  private currMouseButton_ = MOUSE_BUTTON_NONE;

  constructor(camera: PerspectiveCamera, params?: OrbitParams) {
    this.camera_ = camera;

    this.targetPos_ = new Spherical(
      params?.radius ?? 1,
      params?.yaw ?? 0,
      params?.pitch ?? 0
    );

    this.currPos_ = new Spherical(
      this.targetPos_.radius,
      this.targetPos_.phi,
      this.targetPos_.theta
    );

    this.dampingFactor_ = params?.dampingFactor || DEFAULT_DAMPING_FACTOR;
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

  public onUpdate(dt: number) {
    const t = 1.0 - Math.exp(-this.dampingFactor_ * dt);

    this.currPos_.radius = lerp(
      this.currPos_.radius,
      this.targetPos_.radius,
      t
    );
    this.currPos_.phi = lerp(this.currPos_.phi, this.targetPos_.phi, t);
    this.currPos_.theta = lerp(this.currPos_.theta, this.targetPos_.theta, t);

    vec3.lerp(this.currCenter_, this.currCenter_, this.targetCenter_, t);

    const p = vec3.add(vec3.create(), this.currCenter_, this.currPos_.toVec3());

    this.camera_.transform.setTranslation(p);
    this.camera_.transform.targetTo(this.currCenter_);
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
  }

  private onWheel(event: EventContext) {
    const e = event.event as WheelEvent;
    e.preventDefault(); // prevent the page from scrolling

    const dy = e.deltaY ?? 0;
    this.zoom(dy);
  }

  private onPointerEnd(event: EventContext) {
    this.currMouseButton_ = MOUSE_BUTTON_NONE;

    const e = event.event as PointerEvent;
    (e.target as Element)?.releasePointerCapture?.(e.pointerId);
  }

  private orbit(dx: number, dy: number) {
    this.targetPos_.phi -= dx * ORBIT_SPEED;
    this.targetPos_.theta += dy * ORBIT_SPEED;

    // Prevent the camera from reaching the poles (±π/2), where
    // the view direction would flip and orbit controls would invert.
    // We clamp the elevation angle slightly before ±π/2 to maintain
    // stable rotation and avoid gimbal-like artifacts.
    const limit = Math.PI / 2 - glMatrix.EPSILON;
    this.targetPos_.theta = clamp(this.targetPos_.theta, -limit, limit);
  }

  private pan(dx: number, dy: number) {
    // Scale pan speed by distance so movement feels consistent
    const speed = this.targetPos_.radius * PAN_SPEED;
    const delta = vec3.create();

    vec3.scaleAndAdd(delta, delta, this.camera_.right, dx);
    vec3.scaleAndAdd(delta, delta, this.camera_.up, dy);
    vec3.scale(delta, delta, speed);

    vec3.sub(this.targetCenter_, this.targetCenter_, delta);
  }

  private zoom(dy: number) {
    // Exponential for smooth, distance-independent zoom
    const scale = Math.exp(dy * ZOOM_SPEED);
    this.targetPos_.radius = Math.max(0.01, this.targetPos_.radius * scale);
  }
}
