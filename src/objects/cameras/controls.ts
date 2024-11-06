import { vec2, vec3 } from "gl-matrix";
import { Camera } from "./camera";

type ClientToClip = (clientPos: vec2, depth: number) => vec3;
type ClientToWorld = (clientPos: vec2, depth: number) => vec3;

export abstract class CameraControls {
  protected camera_: Camera;

  constructor(camera: Camera) {
    this.camera_ = camera;
  }

  public abstract callbacks(
    target: EventTarget,
    clientToClip: ClientToClip
  ): [string, EventListener][];
}

export class PanZoomControls extends CameraControls {
  private depth_: number;

  constructor(camera: Camera, panDepth: number = 0) {
    super(camera);
    this.depth_ = panDepth;
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
    const preZoomPos = clientToWorld(clientPos, this.depth_);
    if (event.deltaY < 0) {
      this.camera_.zoom *= 1.05;
    } else {
      this.camera_.zoom /= 1.05;
    }
    // pan to zoom in on the mouse position
    const postZoomPos = clientToWorld(clientPos, this.depth_);
    const dWorld = vec3.sub(vec3.create(), postZoomPos, preZoomPos);
    this.camera_.pan(vec3.scale(vec3.create(), dWorld, -1));
  }

  private mousedown(
    event: MouseEvent,
    target: EventTarget,
    clientToWorld: ClientToWorld
  ): void {
    console.log("mousedown", this.camera_.type);
    const clientStart = vec2.fromValues(event.clientX, event.clientY);
    let worldStart = clientToWorld(clientStart, this.depth_);
    console.log(clientStart, worldStart);

    const onMouseMove = (event: Event) => {
      if (!(event instanceof MouseEvent)) {
        throw new Error("Expected MouseEvent");
      }
      const clientPos = vec2.fromValues(event.clientX, event.clientY);
      const worldPos = clientToWorld(clientPos, this.depth_);
      const dWorld = vec3.sub(vec3.create(), worldPos, worldStart);
      this.camera_.pan(vec3.scale(vec3.create(), dWorld, -1));
      worldStart = worldPos;
    };

    const onMouseUp = () => {
      target.removeEventListener("mousemove", onMouseMove);
      target.removeEventListener("mouseup", onMouseUp);
    };

    target.addEventListener("mousemove", onMouseMove);
    target.addEventListener("mouseup", onMouseUp);
  }
}
