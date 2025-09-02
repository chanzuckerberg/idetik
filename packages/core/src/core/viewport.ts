import { Camera } from "../objects/cameras/camera";
import { Layer } from "./layer";
import { LayerManager } from "./layer_manager";
import { CameraControls } from "../objects/cameras/controls";
import { Box2 } from "../math/box2";
import { vec2, vec3 } from "gl-matrix";
import { generateUUID } from "../utilities/uuid_generator";

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
  public cameraControls: CameraControls | null = null;

  private readonly canvas_: HTMLCanvasElement;
  private cachedViewportBox_: Box2 | null = null;

  constructor(
    config: ViewportConfig,
    layerManager: LayerManager,
    canvas: HTMLCanvasElement
  ) {
    this.id = config.id || config.element.id || generateUUID();
    this.element = config.element;
    this.canvas_ = canvas;
    this.camera = config.camera;
    this.layerManager = layerManager;
    this.cameraControls = config.cameraControls ?? null;
    this.updateAspectRatio();

    for (const layer of config.layers ?? []) {
      this.layerManager.add(layer);
    }
  }

  public updateSize(): void {
    this.cachedViewportBox_ = null;
    this.updateAspectRatio();
  }

  public getBoxRelativeToCanvas(): Box2 {
    if (this.cachedViewportBox_) {
      return this.cachedViewportBox_;
    }

    const rect = this.element.getBoundingClientRect();
    const canvasRect = this.canvas_.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;

    // Calculate viewport position relative to canvas in CSS pixels
    const cssX = rect.left - canvasRect.left;
    const cssY = rect.top - canvasRect.top;
    const cssWidth = rect.width;
    const cssHeight = rect.height;

    // Convert to device pixels for WebGL viewport
    // Note: WebGL Y coordinate is flipped, so we adjust the Y position
    const x = Math.floor(cssX * devicePixelRatio);
    const y = Math.floor(
      (canvasRect.height - cssY - cssHeight) * devicePixelRatio
    );
    const width = Math.floor(cssWidth * devicePixelRatio);
    const height = Math.floor(cssHeight * devicePixelRatio);

    this.cachedViewportBox_ = new Box2(
      vec2.fromValues(x, y),
      vec2.fromValues(x + width, y + height)
    );

    return this.cachedViewportBox_;
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

  private updateAspectRatio(): void {
    const { width, height } = this.getBoxRelativeToCanvas().toRect();
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
  createLayerManager: () => LayerManager,
  canvas: HTMLCanvasElement
): Viewport[] {
  validateViewportConfigs(viewportConfigs);

  return viewportConfigs.map((config) => {
    const layerManager = createLayerManager();
    return new Viewport(config, layerManager, canvas);
  });
}
