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
const DEFAULT_DAMPING_FACTOR = 0.3;

type OrbitParams = {
  radius?: number;
  yaw?: number;
  pitch?: number;
  dampingFactor?: number;
};

export class OrbitControls implements CameraControls {
  private readonly camera_: PerspectiveCamera;

  private readonly orbitVelocity_ = new Spherical(0, 0, 0);
  private readonly panVelocity_ = vec3.create();
  private zoomVelocity_ = 0;

  private readonly currPos_: Spherical;
  private readonly currCenter_ = vec3.create();

  private readonly dampingFactor_: number;

  private currMouseButton_ = MOUSE_BUTTON_NONE;

  constructor(camera: PerspectiveCamera, params?: OrbitParams) {
    this.camera_ = camera;

    this.currPos_ = new Spherical(
      params?.radius ?? 1,
      params?.yaw ?? 0,
      params?.pitch ?? 0
    );

    this.dampingFactor_ = clamp(
      params?.dampingFactor ?? DEFAULT_DAMPING_FACTOR,
      0,
      1
    );
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
    this.currPos_.phi += this.orbitVelocity_.phi;
    this.currPos_.theta += this.orbitVelocity_.theta;
    this.currPos_.radius += this.zoomVelocity_ * this.currPos_.radius;

    vec3.add(this.currCenter_, this.currCenter_, this.panVelocity_);

    // Prevent the camera from reaching the poles (±π/2), where
    // the view direction would flip and orbit controls would invert.
    // We clamp the elevation angle slightly before ±π/2 to maintain
    // stable rotation and avoid gimbal-like artifacts.
    const limit = Math.PI / 2 - glMatrix.EPSILON;
    this.currPos_.theta = clamp(this.currPos_.theta, -limit, limit);
    this.currPos_.radius = Math.max(0.01, this.currPos_.radius);

    const p = vec3.add(vec3.create(), this.currCenter_, this.currPos_.toVec3());
    this.camera_.transform.setTranslation(p);
    this.camera_.transform.targetTo(this.currCenter_);

    const damping = Math.pow(1.0 - this.dampingFactor_, dt * 60);
    this.orbitVelocity_.phi *= damping;
    this.orbitVelocity_.theta *= damping;
    this.zoomVelocity_ *= damping;
    vec3.scale(this.panVelocity_, this.panVelocity_, damping);
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
    this.orbitVelocity_.phi -= dx * ORBIT_SPEED;
    this.orbitVelocity_.theta += dy * ORBIT_SPEED;
  }

  private pan(dx: number, dy: number) {
    const speed = this.currPos_.radius * PAN_SPEED;
    const delta = vec3.create();

    vec3.scaleAndAdd(delta, delta, this.camera_.right, dx);
    vec3.scaleAndAdd(delta, delta, this.camera_.up, dy);
    vec3.scale(delta, delta, speed);

    vec3.sub(this.panVelocity_, this.panVelocity_, delta);
  }

  private zoom(dy: number) {
    this.zoomVelocity_ += dy * ZOOM_SPEED;
  }
}
