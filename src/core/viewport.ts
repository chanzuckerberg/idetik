import { Camera } from "../objects/cameras/camera";
import { Layer } from "./layer";
import { CameraControls } from "../objects/cameras/controls";
import { Box2 } from "../math/box2";
import { vec2, vec3 } from "gl-matrix";
import { generateID } from "../utilities/id_generator";
import { Logger } from "../utilities/logger";
import { EventContext, EventDispatcher } from "./event_dispatcher";
import { Ray } from "../math/ray";

export interface ViewportProps {
  id?: string;
  domElement: HTMLElement;
  camera: Camera;
  layers?: Layer[];
  cameraControls?: CameraControls;
}

export class Viewport {
  public readonly id: string;
  public readonly domElement: HTMLElement;
  public readonly camera: Camera;
  public readonly events: EventDispatcher;
  public cameraControls?: CameraControls;

  private layers_: Layer[] = [];

  constructor(props: ViewportProps) {
    this.id = props.id || props.domElement.id || generateID("viewport");
    this.domElement = props.domElement;
    this.camera = props.camera;
    this.cameraControls = props.cameraControls;
    this.updateAspectRatio();
    this.events = new EventDispatcher(this.domElement);
    this.events.addEventListener((event: EventContext) => {
      if (
        event.event instanceof PointerEvent ||
        event.event instanceof WheelEvent
      ) {
        const { clientX, clientY } = event.event;
        const client = vec2.fromValues(clientX, clientY);
        event.clipPos = this.clientToClip(client, 0);
        event.worldPos = this.camera.clipToWorld(event.clipPos);

        const near = this.camera.clipToWorld(this.clientToClip(client, -1));
        const far = this.camera.clipToWorld(this.clientToClip(client, 1));
        event.worldRay = new Ray(near, vec3.subtract(vec3.create(), far, near));
      }
      for (const layer of this.layers_) {
        layer.onEvent(event);
        if (event.propagationStopped) return;
      }
      this.cameraControls?.onEvent(event);
    });

    this.layers_ = [...(props.layers ?? [])];
  }

  public get layers(): readonly Layer[] {
    return this.layers_;
  }

  public addLayer(layer: Layer): void {
    this.layers_.push(layer);
  }

  public removeLayer(layer: Layer): void {
    const index = this.layers_.indexOf(layer);
    if (index === -1) {
      throw new Error(`Layer to remove not found: ${layer}`);
    }
    this.layers_.splice(index, 1);
    layer.onDetached(this);
  }

  public removeAllLayers(): void {
    for (const layer of this.layers_) {
      layer.onDetached(this);
    }
    this.layers_ = [];
  }

  public updateSize(): void {
    this.updateAspectRatio();
  }

  public getBoxRelativeTo(relativeElement: HTMLElement): Box2 {
    const viewportRect = this.getBox().toRect();
    const relativeRect = relativeElement.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;

    // Convert the relative element's rect to device pixels.
    // The viewport rect is already in device pixels.
    const relativeElementX = relativeRect.left * devicePixelRatio;
    const relativeElementY = relativeRect.top * devicePixelRatio;
    const relativeElementHeight = relativeRect.height * devicePixelRatio;

    const relativeX = viewportRect.x - relativeElementX;
    const relativeY = viewportRect.y - relativeElementY;

    // Note: WebGL Y coordinate is flipped, so we adjust the Y position
    const x = Math.floor(relativeX);
    const y = Math.floor(
      relativeElementHeight - relativeY - viewportRect.height
    );
    const width = Math.floor(viewportRect.width);
    const height = Math.floor(viewportRect.height);

    return new Box2(
      vec2.fromValues(x, y),
      vec2.fromValues(x + width, y + height)
    );
  }

  public getBufferRect(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    return this.getBoxRelativeTo(this.domElement).toRect();
  }

  public clientToClip(position: vec2, depth: number = 0): vec3 {
    const [x, y] = position;
    const rect = this.domElement.getBoundingClientRect();
    return vec3.fromValues(
      (2 * (x - rect.x)) / rect.width - 1,
      (2 * (y - rect.y)) / rect.height - 1,
      depth
    );
  }

  public clientToWorld(position: vec2, depth: number = 0): vec3 {
    const clipPos = this.clientToClip(position, depth);
    return this.camera.clipToWorld(clipPos);
  }

  private getBox(): Box2 {
    const viewportRect = this.domElement.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;

    const x = viewportRect.left * devicePixelRatio;
    const y = viewportRect.top * devicePixelRatio;
    const width = viewportRect.width * devicePixelRatio;
    const height = viewportRect.height * devicePixelRatio;

    return new Box2(
      vec2.fromValues(x, y),
      vec2.fromValues(x + width, y + height)
    );
  }

  private updateAspectRatio(): void {
    const { width, height } = this.getBox().toRect();
    if (width <= 0 || height <= 0) {
      Logger.debug(
        "Viewport",
        `Skipping aspect ratio update for viewport ${this.id}: invalid dimensions ${width}x${height}`
      );
      return;
    }
    const aspectRatio = width / height;
    this.camera.setAspectRatio(aspectRatio);
  }
}
