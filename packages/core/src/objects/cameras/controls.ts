import { vec2, vec3 } from "gl-matrix";
import { Camera } from "./camera";

type ClientToClip = (clientPos: vec2, depth: number) => vec3;
type ClientToWorld = (clientPos: vec2, depth: number) => vec3;

export interface CameraControls {
  callbacks(
    target: EventTarget,
    clientToClip: ClientToClip
  ): [string, EventListener][];
}

export class NullControls implements CameraControls {
  public callbacks(
    _target: EventTarget,
    _clientToClip: ClientToClip
  ): [string, EventListener][] {
    return [];
  }
}

export class PanZoomControls implements CameraControls {
  protected camera_: Camera;
  private panTarget_: vec3;

  constructor(camera: Camera, panTarget: vec3 = vec3.fromValues(0, 0, 0)) {
    this.camera_ = camera;
    this.panTarget_ = panTarget;
  }

  public callbacks(
    target: EventTarget,
    clientToClip: ClientToClip
  ): [string, EventListener][] {
    const clientToWorld: ClientToWorld = (clientPos, depth) => {
      const clipPos = clientToClip(clientPos, depth);
      return this.camera_.clipToWorld(clipPos);
    };
    return [
      [
        "wheel",
        (event: Event) => this.wheel(event as WheelEvent, clientToWorld),
      ],
      [
        "pointerdown",
        (event: Event) =>
          this.pointerdown(event as PointerEvent, target, clientToWorld),
      ],
    ];
  }

  private wheel(event: WheelEvent, clientToWorld: ClientToWorld) {
    event.preventDefault();
    const clientPos = vec2.fromValues(event.clientX, event.clientY);
    const preZoomPos = clientToWorld(clientPos, this.clipDepth);
    const zoomFactor = 1.05;
    if (event.deltaY < 0) {
      this.camera_.zoom(zoomFactor);
    } else {
      this.camera_.zoom(1.0 / zoomFactor);
    }
    // pan to zoom in on the mouse position
    const postZoomPos = clientToWorld(clientPos, this.clipDepth);
    const deltaWorld = vec3.sub(vec3.create(), preZoomPos, postZoomPos);
    this.pan(deltaWorld);
  }

  private pointerdown(
    event: PointerEvent,
    target: EventTarget,
    clientToWorld: ClientToWorld
  ) {
    if (event.button !== 0) {
      return;
    }

    const clientStart = vec2.fromValues(event.clientX, event.clientY);
    const worldStart = clientToWorld(clientStart, this.clipDepth);
    const pointerId = event.pointerId;

    // capture the pointer to ensure we receive events even when outside the element
    if (target instanceof Element) {
      target.setPointerCapture(pointerId);
    }

    const onPointerMove = (event: Event) => {
      if (!(event instanceof PointerEvent) || event.pointerId !== pointerId) {
        return;
      }
      const clientPos = vec2.fromValues(event.clientX, event.clientY);
      const worldPos = clientToWorld(clientPos, this.clipDepth);
      const deltaWorld = vec3.sub(vec3.create(), worldStart, worldPos);
      this.pan(deltaWorld);
    };

    const onPointerUp = (event: Event) => {
      if (!(event instanceof PointerEvent) || event.pointerId !== pointerId) {
        return;
      }
      target.removeEventListener("pointermove", onPointerMove);
      target.removeEventListener("pointerup", onPointerUp);
      target.removeEventListener("pointercancel", onPointerUp);

      if (target instanceof Element) {
        target.releasePointerCapture(pointerId);
      }
    };

    target.addEventListener("pointermove", onPointerMove);
    target.addEventListener("pointerup", onPointerUp);
    target.addEventListener("pointercancel", onPointerUp);
  }

  protected pan(deltaWorld: vec3) {
    this.camera_.pan(deltaWorld);
    vec3.add(this.panTarget_, this.panTarget_, deltaWorld);
  }

  public set panTarget(panTarget: vec3) {
    this.panTarget_ = panTarget;
  }

  protected get clipDepth() {
    const targetToPosition = vec3.sub(
      vec3.create(),
      this.panTarget_,
      this.camera_.position
    );
    const projectedViewVector = vec3.transformMat4(
      vec3.create(),
      targetToPosition,
      this.camera_.projectionMatrix
    );
    // TODO: the distance should be projected onto the camera's view
    // normal when we start rotating cameras
    const distance = vec3.length(projectedViewVector);
    return distance;
  }
}
