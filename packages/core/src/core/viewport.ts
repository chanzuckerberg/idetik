import { Camera } from "../objects/cameras/camera";
import { Layer } from "./layer";
import { LayerManager } from "./layer_manager";
import { CameraControls } from "../objects/cameras/controls";
import { Box2 } from "../math/box2";
import { vec2 } from "gl-matrix";
import { ChunkManager } from "./chunk_manager";
import { generateUUID } from "../utilities/uuid_generator";

export function parseViewportConfigs(
  viewportConfigs: ViewportConfig[]
): Viewport[] {
  const elementToViewportId = new Map<HTMLElement, string>();

  for (const config of viewportConfigs) {
    const viewportId = config.id || config.element.id || "unnamed";

    if (elementToViewportId.has(config.element)) {
      const existingViewportId = elementToViewportId.get(config.element)!;
      const elementDescription =
        config.element.tagName.toLowerCase() +
        (config.element.id ? `#${config.element.id}` : "[element has no id]");
      throw new Error(
        `Multiple viewports cannot share the same HTML element: ` +
          `viewports "${existingViewportId}" and "${viewportId}" both use ${elementDescription}`
      );
    }
    elementToViewportId.set(config.element, viewportId);
  }

  return viewportConfigs.map((config) => new Viewport(config));
}

export type IdetikContext = {
  chunkManager: ChunkManager;
};

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
  public readonly layers: Layer[];
  public cameraControls?: CameraControls;
  private readonly layerManager_: LayerManager;
  private readonly chunkManager_: ChunkManager;

  constructor(config: ViewportConfig) {
    this.id = config.id || config.element.id || generateUUID();
    this.element = config.element;
    this.camera = config.camera;
    this.layers = config.layers || [];
    this.cameraControls = config.cameraControls;

    // TODO: the chunk manager should be fixed to be shareable across viewports
    // Create per-viewport chunk manager and context
    this.chunkManager_ = new ChunkManager();
    const context = {
      chunkManager: this.chunkManager_,
    };

    // Create persistent layer manager for this viewport
    this.layerManager_ = new LayerManager(context);
    for (const layer of this.layers) {
      this.layerManager_.add(layer);
    }
  }

  public get layerManager(): LayerManager {
    return this.layerManager_;
  }

  public get chunkManager(): ChunkManager {
    return this.chunkManager_;
  }

  public calculateViewportBox(canvas: HTMLCanvasElement): Box2 {
    const rect = this.element.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
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

    return new Box2(
      vec2.fromValues(x, y),
      vec2.fromValues(x + width, y + height)
    );
  }

  public clientToViewportClip(
    clientX: number,
    clientY: number
  ): { clipX: number; clipY: number } {
    const rect = this.element.getBoundingClientRect();
    const viewportClientX = clientX - rect.left;
    const viewportClientY = clientY - rect.top;

    const clipX = (2 * viewportClientX) / rect.width - 1;
    const clipY = (2 * viewportClientY) / rect.height - 1;

    return { clipX, clipY };
  }
}
