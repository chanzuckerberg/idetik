import { WebGLRenderer } from "./renderers/webgl_renderer";
import { Logger } from "./utilities/logger";
import { ChunkManager } from "./core/chunk_manager";
import { OrthographicCamera } from "./objects/cameras/orthographic_camera";
import { createStats, type Stats } from "./utilities/stats";
import {
  parseViewportConfigs,
  Viewport,
  ViewportConfig,
} from "./core/viewport";
import { PixelSizeObserver } from "./utilities/pixel_size_observer";

type Overlay = {
  update(idetik: Idetik, timestamp?: DOMHighResTimeStamp): void;
};

type IdetikParams = {
  canvas: HTMLCanvasElement;
  viewports: [ViewportConfig, ...ViewportConfig[]]; // at least one viewport required
  overlays?: Overlay[];
  showStats?: boolean;
};

export type IdetikContext = {
  chunkManager: ChunkManager;
};

export class Idetik {
  private lastAnimationId_?: number;
  private readonly chunkManager_: ChunkManager;
  private readonly context_: IdetikContext;
  private readonly renderer_: WebGLRenderer;
  private readonly viewports_: Viewport[];
  public readonly canvas: HTMLCanvasElement;
  public readonly overlays: Overlay[];
  private readonly stats_?: Stats;
  private readonly sizeObserver_: PixelSizeObserver;

  /**
   * Creates a new Idetik visualization runtime instance.
   *
   * @param params - Configuration parameters for the Idetik instance
   * @param params.canvas - HTMLCanvasElement to render to
   * @param params.viewports - Array of viewport configurations. (At least one required.)
   *   Each viewport renders with its own camera, layers, and controls.
   *   The `element` property is optional and defaults to the canvas if not provided.
   *   Elements must be unique across viewports.
   *   The `id` property is optional but useful for referencing specific viewports later.
   * @param params.overlays - Optional array of overlay objects that update each frame (e.g., for HUD elements)
   * @param params.showStats - Optional flag to display performance statistics
   *
   * @example
   * // Single viewport (element defaults to canvas)
   * const camera = new OrthographicCamera(0, 1024, 0, 1024);
   * const idetik = new Idetik({
   *   canvas: document.querySelector('canvas')!,
   *   viewports: [{
   *     camera: camera,
   *     layers: [imageLayer],
   *     cameraControls: new PanZoomControls(camera)
   *   }]
   * });
   *
   * @example
   * // Multiple viewports - one defaults to canvas, others use separate elements
   * const idetik = new Idetik({
   *   canvas: document.querySelector('canvas')!,
   *   viewports: [
   *     {
   *       id: 'main',
   *       // element omitted - defaults to canvas
   *       camera: camera1,
   *       layers: [layer1]
   *     },
   *     {
   *       id: 'minimap',
   *       element: document.querySelector('#minimap')!,
   *       camera: camera2,
   *       layers: [layer2]
   *     }
   *   ]
   * });
   *
   * @throws {Error} If viewports array is empty or not provided
   * @throws {Error} If viewports have duplicate IDs or shared elements
   */
  constructor(params: IdetikParams) {
    this.canvas = params.canvas;

    if (params.viewports.length === 0) {
      throw new Error("At least one viewport config must be specified.");
    }

    this.renderer_ = new WebGLRenderer(this.canvas);
    this.chunkManager_ = new ChunkManager();
    this.context_ = {
      chunkManager: this.chunkManager_,
    };

    this.viewports_ = parseViewportConfigs(
      params.viewports,
      this.canvas,
      this.context_
    );

    this.overlays = params.overlays ?? [];

    if (params.showStats) this.stats_ = createStats();

    const sizeDependents: HTMLElement[] = [this.canvas];
    for (const viewport of this.viewports_) {
      if (viewport.element !== this.canvas) {
        sizeDependents.push(viewport.element);
      }
    }
    this.sizeObserver_ = new PixelSizeObserver(sizeDependents);
  }

  public get renderedObjects() {
    return this.renderer_.renderedObjects;
  }

  public get width() {
    return this.renderer_.width;
  }

  public get height() {
    return this.renderer_.height;
  }

  public get textureInfo() {
    return this.renderer_.textureInfo;
  }

  public get viewports(): readonly Viewport[] {
    return this.viewports_;
  }

  public getViewport(id: string): Viewport | undefined {
    return this.viewports_.find((v) => v.id === id);
  }

  public start() {
    Logger.info("Idetik", "Idetik runtime starting");
    if (this.lastAnimationId_ === undefined) {
      for (const viewport of this.viewports_) {
        viewport.events.connect();
      }
      this.sizeObserver_.connect();
      this.animate();
    } else {
      Logger.warn("Idetik", "Idetik runtime already started");
    }
    return this;
  }

  private animate(timestamp?: DOMHighResTimeStamp) {
    if (this.stats_) this.stats_.begin();

    // Must resize before render b/c changing canvas coordinate space clears it.
    if (this.sizeObserver_.getAndResetChanged()) {
      this.updateSize();
    }

    for (const viewport of this.viewports_) {
      if (viewport.camera.type === "OrthographicCamera") {
        this.chunkManager_.update(
          viewport.camera as OrthographicCamera,
          viewport.getBoxRelativeTo(this.canvas).toRect().width,
          timestamp
        );
      }
      this.renderer_.render(viewport, timestamp);
    }

    for (const overlay of this.overlays) {
      overlay.update(this, timestamp);
    }

    if (this.stats_) this.stats_.end();
    this.lastAnimationId_ = requestAnimationFrame((timestamp) =>
      this.animate(timestamp)
    );
  }

  public stop() {
    Logger.info("Idetik", "Idetik runtime stopping");
    if (this.lastAnimationId_ === undefined) {
      Logger.warn("Idetik", "Idetik runtime not started");
    } else {
      this.sizeObserver_.disconnect();
      for (const viewport of this.viewports_) {
        viewport.events.disconnect();
      }
      cancelAnimationFrame(this.lastAnimationId_);
      this.lastAnimationId_ = undefined;
    }
  }

  private updateSize() {
    this.renderer_.updateSize();
    for (const viewport of this.viewports_) {
      viewport.updateSize();
    }
  }
}
