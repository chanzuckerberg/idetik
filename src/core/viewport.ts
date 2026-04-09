import { Camera } from "../objects/cameras/camera";
import { Layer } from "./layer";
import { LayerManager } from "./layer_manager";
import { CameraControls } from "../objects/cameras/controls";
import { Box2 } from "../math/box2";
import { vec2, vec3 } from "gl-matrix";
import { generateID } from "../utilities/id_generator";
import { Logger } from "../utilities/logger";
import { EventContext, EventDispatcher } from "./event_dispatcher";
import { IdetikContext } from "../idetik";

export interface ViewportConfig {
  id?: string;
  element?: HTMLElement;
  camera: Camera;
  layers?: Layer[];
  cameraControls?: CameraControls;
}

interface ViewportProps extends ViewportConfig {
  id: string;
  element: HTMLElement;
  layerManager: LayerManager;
}

export class Viewport {
  public readonly id: string;
  public readonly element: HTMLElement;
  public readonly camera: Camera;
  public readonly layerManager: LayerManager;
  public readonly events: EventDispatcher;
  public cameraControls?: CameraControls;

  constructor(props: ViewportProps) {
    this.id = props.id;
    this.element = props.element;
    this.camera = props.camera;
    this.layerManager = props.layerManager;
    this.cameraControls = props.cameraControls;
    this.updateAspectRatio();
    this.events = new EventDispatcher(this.element);
    this.events.addEventListener((event: EventContext) => {
      if (
        event.event instanceof PointerEvent ||
        event.event instanceof WheelEvent
      ) {
        const { clientX, clientY } = event.event;
        const client = vec2.fromValues(clientX, clientY);
        event.clipPos = this.clientToClip(client, 0);
        event.worldPos = this.camera.clipToWorld(event.clipPos);
      }
      for (const layer of this.layerManager.layers) {
        layer.onEvent(event);
        if (event.propagationStopped) return;
      }
      this.cameraControls?.onEvent(event);
    });

    for (const layer of props.layers ?? []) {
      this.layerManager.add(layer);
    }
  }

  public updateSize(): void {
    this.updateAspectRatio();
  }

  public getBoxRelativeTo(canvas: HTMLCanvasElement): Box2 {
    const viewportRect = this.getBox().toRect();
    const canvasRect = canvas.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;

    // convert canvas rect to device pixels
    // viewport rect is already in device pixels
    const canvasX = canvasRect.left * devicePixelRatio;
    const canvasY = canvasRect.top * devicePixelRatio;
    const canvasHeight = canvasRect.height * devicePixelRatio;

    const relativeX = viewportRect.x - canvasX;
    const relativeY = viewportRect.y - canvasY;

    // Note: WebGL Y coordinate is flipped, so we adjust the Y position
    const x = Math.floor(relativeX);
    const y = Math.floor(canvasHeight - relativeY - viewportRect.height);
    const width = Math.floor(viewportRect.width);
    const height = Math.floor(viewportRect.height);

    return new Box2(
      vec2.fromValues(x, y),
      vec2.fromValues(x + width, y + height)
    );
  }

  public clientToClip(position: vec2, depth: number = 0): vec3 {
    const [x, y] = position;
    const rect = this.element.getBoundingClientRect();
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
    const viewportRect = this.element.getBoundingClientRect();
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

export function validateNewViewport(
  viewport: { id: string; element: HTMLElement },
  existingViewports: { id: string; element: HTMLElement }[]
): void {
  for (const existing of existingViewports) {
    if (existing.id === viewport.id) {
      throw new Error(
        `Duplicate viewport ID "${viewport.id}". Each viewport must have a unique ID.`
      );
    }
    if (existing.element === viewport.element) {
      const elementDescription =
        viewport.element.tagName.toLowerCase() +
        (viewport.element.id
          ? `#${viewport.element.id}`
          : "[element has no id]");
      throw new Error(
        "Multiple viewports cannot share the same HTML element: " +
          `viewports "${existing.id}" and "${viewport.id}" both use ${elementDescription}`
      );
    }
  }
}

function validateViewportProps(viewportProps: ViewportProps[]): void {
  for (let i = 0; i < viewportProps.length; i++) {
    validateNewViewport(viewportProps[i], viewportProps.slice(0, i));
  }
}

export function parseViewportConfigs(
  viewportConfigs: ViewportConfig[],
  canvas: HTMLCanvasElement,
  context: IdetikContext
): Viewport[] {
  const viewportProps: ViewportProps[] = viewportConfigs.map((config) => {
    const element = config.element ?? canvas;
    return {
      ...config,
      element,
      id: config.id ?? element.id ?? generateID("viewport"),
      layerManager: new LayerManager(context),
    };
  });
  validateViewportProps(viewportProps);
  return viewportProps.map((props) => new Viewport(props));
}
