import { Camera } from "../objects/cameras/camera";
import { Layer } from "./layer";
import { LayerManager } from "./layer_manager";
import { CameraControls } from "../objects/cameras/controls";
import { Box2 } from "../math/box2";
import { vec2, vec3 } from "gl-matrix";
import { generateUUID } from "../utilities/uuid_generator";
import { Logger } from "../utilities/logger";

export interface ViewportConfig {
  id?: string;
  element: HTMLElement;
  camera: Camera;
  layers?: Layer[];
  cameraControls?: CameraControls;
}

export class Viewport {
  public readonly id: string;
  public readonly element: HTMLElement;
  public readonly camera: Camera;
  public readonly layerManager: LayerManager;
  public cameraControls?: CameraControls;

  constructor(config: ViewportConfig, layerManager: LayerManager) {
    this.id = config.id || config.element.id || generateUUID();
    this.element = config.element;
    this.camera = config.camera;
    this.layerManager = layerManager;
    this.cameraControls = config.cameraControls;
    this.updateAspectRatio();

    for (const layer of config.layers ?? []) {
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

function validateViewportConfigs(viewportConfigs: ViewportConfig[]): void {
  const elementToViewportId = new Map<HTMLElement, string>();
  const seenViewportIds = new Set<string>();

  for (const config of viewportConfigs) {
    const viewportId = config.id || config.element.id;

    // check for duplicate viewport IDs if we have an explicit ID
    // (viewports without IDs will get unique generated IDs)
    if (viewportId && seenViewportIds.has(viewportId)) {
      throw new Error(
        `Duplicate viewport ID "${viewportId}". Each viewport must have a unique ID.`
      );
    }
    if (viewportId) {
      seenViewportIds.add(viewportId);
    }

    const newViewportId = viewportId || "unnamed-viewport";

    // check for multiple viewports specified with the same element
    if (elementToViewportId.has(config.element)) {
      const existingViewportId = elementToViewportId.get(config.element)!;
      const elementDescription =
        config.element.tagName.toLowerCase() +
        (config.element.id ? `#${config.element.id}` : "[element has no id]");
      throw new Error(
        `Multiple viewports cannot share the same HTML element: ` +
          `viewports "${existingViewportId}" and "${newViewportId}" both use ${elementDescription}`
      );
    }
    elementToViewportId.set(config.element, newViewportId);
  }
}

export function parseViewportConfigs(
  viewportConfigs: ViewportConfig[],
  createLayerManager: () => LayerManager
): Viewport[] {
  validateViewportConfigs(viewportConfigs);

  return viewportConfigs.map((config) => {
    const layerManager = createLayerManager();
    return new Viewport(config, layerManager);
  });
}
