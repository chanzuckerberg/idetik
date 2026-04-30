import { WebGLRenderer } from "./renderers/webgl_renderer";
import { createWebGPURenderer } from "./renderers/webgpu/webgpu_renderer";
import { Logger } from "./utilities/logger";
import { ChunkManager } from "./core/chunk_manager";
import { Renderer } from "./core/renderer";
import { createStats, type Stats } from "./utilities/stats";
import {
  parseViewportConfigs,
  validateNewViewport,
  Viewport,
  ViewportConfig,
} from "./core/viewport";
import { PixelSizeObserver } from "./utilities/pixel_size_observer";

export type Overlay = {
  update(idetik: Idetik): void;
};

type IdetikParams = {
  canvas: HTMLCanvasElement;
  viewports?: ViewportConfig[];
  overlays?: Overlay[];
  showStats?: boolean;
};

export type IdetikContext = {
  chunkManager: ChunkManager;
};

export class Idetik {
  private readonly chunkManager_: ChunkManager;
  private readonly context_: IdetikContext;
  private readonly renderer_: Renderer;
  private readonly viewports_: Viewport[];
  public readonly canvas: HTMLCanvasElement;
  public readonly overlays: Overlay[];
  private readonly stats_?: Stats;
  private readonly sizeObserver_: PixelSizeObserver;
  private lastAnimationId_?: number;

  // this value will be set after start
  private lastTimestamp_: DOMHighResTimeStamp = 0;

  /**
   * Creates a new Idetik visualization runtime instance.
   *
   * @param params - Configuration parameters for the Idetik instance
   * @param params.canvas - HTMLCanvasElement to render to
   * @param params.viewports - Optional array of viewport configurations.
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
   * @throws {Error} If viewports have duplicate IDs or shared elements
   */
  static async create(
    params: IdetikParams & { renderer: "webgpu-experimental" }
  ): Promise<Idetik> {
    const renderer = await createWebGPURenderer(params.canvas);
    return new Idetik(params, renderer);
  }

  constructor(params: IdetikParams, renderer?: Renderer) {
    this.canvas = params.canvas;

    this.renderer_ = renderer ?? new WebGLRenderer(this.canvas);
    this.chunkManager_ = new ChunkManager();
    this.context_ = {
      chunkManager: this.chunkManager_,
    };

    this.viewports_ = parseViewportConfigs(
      params.viewports ?? [],
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
    this.sizeObserver_ = new PixelSizeObserver(sizeDependents, () => {
      this.renderer_.updateSize();
      this.renderer_.beginFrame();
      for (const viewport of this.viewports_) {
        viewport.updateSize();
        this.renderer_.render(viewport);
      }
    });
  }

  public get chunkQueueStats() {
    return this.chunkManager_.queueStats;
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

  public get viewports(): readonly Viewport[] {
    return this.viewports_;
  }

  public get running(): boolean {
    return this.lastAnimationId_ !== undefined;
  }

  public getViewport(id: string): Viewport | undefined {
    return this.viewports_.find((v) => v.id === id);
  }

  public addViewport(config: ViewportConfig): Viewport {
    const [viewport] = parseViewportConfigs(
      [config],
      this.canvas,
      this.context_
    );

    validateNewViewport(viewport, this.viewports_);
    this.viewports_.push(viewport);

    if (this.running) {
      viewport.events.connect();
      if (viewport.element !== this.canvas) {
        this.sizeObserver_.observe(viewport.element);
      }
    }

    Logger.info("Idetik", `Added viewport "${viewport.id}"`);
    return viewport;
  }

  public removeViewport(viewport: Viewport): boolean {
    const index = this.viewports_.indexOf(viewport);

    if (index === -1) {
      Logger.warn(
        "Idetik",
        `Viewport "${viewport.id}" not found, nothing to remove`
      );
      return false;
    }

    if (this.running) {
      viewport.events.disconnect();
      if (viewport.element !== this.canvas) {
        this.sizeObserver_.unobserve(viewport.element);
      }
    }

    this.viewports_.splice(index, 1);
    Logger.info("Idetik", `Removed viewport "${viewport.id}"`);
    return true;
  }

  public start() {
    Logger.info("Idetik", "Idetik runtime starting");
    if (!this.running) {
      for (const viewport of this.viewports_) {
        viewport.events.connect();
      }
      this.sizeObserver_.connect();

      this.lastAnimationId_ = requestAnimationFrame((timestamp) => {
        this.lastTimestamp_ = timestamp;
        this.animate(timestamp);
      });
    } else {
      Logger.warn("Idetik", "Idetik runtime already started");
    }
    return this;
  }

  private animate(timestamp: DOMHighResTimeStamp) {
    if (this.stats_) this.stats_.begin();

    // cap dt to prevent large time-step jumps when resuming from background tabs
    const dt = Math.min(timestamp - this.lastTimestamp_, 100) / 1000;

    this.lastTimestamp_ = timestamp;

    this.renderer_.beginFrame();
    for (const viewport of this.viewports_) {
      viewport.cameraControls?.onUpdate(dt);
      this.renderer_.render(viewport);
    }

    this.chunkManager_.update();

    for (const overlay of this.overlays) {
      overlay.update(this);
    }

    if (this.stats_) this.stats_.end();
    this.lastAnimationId_ = requestAnimationFrame((timestamp) =>
      this.animate(timestamp)
    );
  }

  public stop() {
    Logger.info("Idetik", "Idetik runtime stopping");
    if (!this.running) {
      Logger.warn("Idetik", "Idetik runtime not started");
    } else {
      this.sizeObserver_.disconnect();
      for (const viewport of this.viewports_) {
        viewport.events.disconnect();
      }
      // safe non-null assertion: this.running is true, so lastAnimationId_ is defined
      cancelAnimationFrame(this.lastAnimationId_!);
      this.lastAnimationId_ = undefined;
    }
  }
}
