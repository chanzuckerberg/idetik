import { vec2, vec3 } from "gl-matrix";
import { Camera } from "./camera";
import { PerspectiveCamera } from "./perspective_camera";

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
  private camera_: Camera;

  constructor(camera: Camera) {
    this.camera_ = camera;
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
        "mousedown",
        (event: Event) =>
          this.mousedown(event as MouseEvent, target, clientToWorld),
      ],
    ];
  }

  private wheel(event: WheelEvent, clientToWorld: ClientToWorld): void {
    const clientPos = vec2.fromValues(event.clientX, event.clientY);
    const preZoomPos = clientToWorld(clientPos, this.clipDepth);
    if (event.deltaY < 0) {
      this.camera_.zoom *= 1.05;
    } else {
      this.camera_.zoom /= 1.05;
    }
    // pan to zoom in on the mouse position
    const postZoomPos = clientToWorld(clientPos, this.clipDepth);
    const deltaWorld = vec3.sub(vec3.create(), preZoomPos, postZoomPos);
    this.camera_.pan(deltaWorld);
  }

  private mousedown(
    event: MouseEvent,
    target: EventTarget,
    clientToWorld: ClientToWorld
  ): void {
    const clientStart = vec2.fromValues(event.clientX, event.clientY);
    let worldStart = clientToWorld(clientStart, this.clipDepth);

    const onMouseMove = (event: Event) => {
      if (!(event instanceof MouseEvent)) {
        throw new Error("Expected MouseEvent");
      }
      const clientPos = vec2.fromValues(event.clientX, event.clientY);
      const worldPos = clientToWorld(clientPos, this.clipDepth);
      const deltaWorld = vec3.sub(vec3.create(), worldStart, worldPos);
      this.camera_.pan(deltaWorld);
      worldStart = worldPos;
    };

    const onMouseUp = () => {
      target.removeEventListener("mousemove", onMouseMove);
      target.removeEventListener("mouseup", onMouseUp);
    };

    target.addEventListener("mousemove", onMouseMove);
    target.addEventListener("mouseup", onMouseUp);
  }

  private get clipDepth() {
    let distance = 0;
    if (this.camera_ instanceof PerspectiveCamera) {
      const targetToPosition = vec3.sub(
        vec3.create(),
        this.camera_.target,
        this.camera_.position
      );
      const projectedViewVector = vec3.transformMat4(
        vec3.create(),
        targetToPosition,
        this.camera_.projectionMatrix
      );
      distance = vec3.length(projectedViewVector);
    }
    return distance;
  }
}
