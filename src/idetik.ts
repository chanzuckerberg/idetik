import { WebGLRenderer } from "./renderers/webgl_renderer";
import { Logger } from "./utilities/logger";
import { ChunkManager } from "./data/chunk_manager";
import { Renderer } from "./core/renderer";
import { createStats, type Stats } from "./utilities/stats";
import {
  validateNewViewport,
  validateViewports,
  Viewport,
} from "./core/viewport";
import { PixelSizeObserver } from "./utilities/pixel_size_observer";

const DEFAULT_MEMORY_LIMIT_MB = 2048;

/**
 * An object updated once per frame after all viewports have rendered.
 *
 * Overlays drive HUD elements that live outside the canvas such as scale
 * bars, time indicators, or memory readouts.
 *
 * ```ts
 * const chunkReadout: Overlay = {
 *   update(idetik) {
 *     div.textContent = `${idetik.memoryStats.cpuChunkCount} chunks`;
 *   },
 * };
 *
 * idetik.addOverlay(chunkReadout);
 * ```
 */
export type Overlay = {
  /** Called once per rendered frame. */
  update: (idetik: Idetik) => void;
};

/**
 * Initialization properties for constructing an Idetik instance.
 */
export type IdetikProps = {
  /** The canvas element to render into. */
  canvas: HTMLCanvasElement;
  viewports?: Viewport[];
  overlays?: Overlay[];
  /** Shows an FPS meter. Defaults to `false`. */
  showStats?: boolean;
  /** Memory budget for chunk data. Defaults to `2048`. */
  memoryLimitMB?: number;
  /** Max in-flight chunk requests. Defaults to `8`. */
  maxConcurrentRequests?: number;
  /** Max GPU texture uploads per frame. Defaults to `4`. */
  maxGpuUploadsPerUpdate?: number;
};

export type IdetikContext = {
  chunkManager: ChunkManager;
};

/**
 * A snapshot of the runtime's memory usage.
 */
export type MemoryStats = {
  /** Bytes of chunk data held in CPU memory. */
  cpuChunkBytes: number;
  /** Number of chunks held in CPU memory. */
  cpuChunkCount: number;
  /** Bytes of texture data resident on the GPU. */
  gpuTextureBytes: number;
  /** Number of textures resident on the GPU. */
  gpuTextureCount: number;
  /** Used JS heap in bytes. */
  jsHeapUsedBytes?: number;
  /** JS heap size limit in bytes. */
  jsHeapLimitBytes?: number;
};

/**
 * The entry point of an Idetik application.
 *
 * An Idetik instance owns the renderer and the chunk manager and drives the
 * render loop for the viewports it is given. Each viewport pairs a camera
 * and its controls with a stack of layers and draws into a region of the
 * shared canvas. Layers in all viewports stream chunks through the same
 * manager under a single memory budget.
 *
 * ```ts
 * const source = await OmeZarrImageSource.fromHttp({ url });
 *
 * const layer = new ImageLayer({
 *   source,
 *   sliceCoords: { t: 0, z: 0, c: [0] },
 * });
 *
 * const camera = new OrthographicCamera({
 *   left: 0,
 *   right: 1024,
 *   top: 0,
 *   bottom: 1024,
 * });
 *
 * const idetik = new Idetik({
 *   canvas: document.querySelector('canvas')!,
 *   viewports: [{
 *     camera,
 *     layers: [layer],
 *     cameraControls: new PanZoomControls(camera),
 *   }],
 * });
 *
 * idetik.start();
 * ```
 *
 * @see {@link Layer} for the data layers rendered within a viewport.
 *
 * @group Core
 */
export class Idetik {
  /** The canvas element the renderer draws into. */
  public readonly canvas: HTMLCanvasElement;
  /** The registered overlays that update once per frame in order. */
  public readonly overlays: Overlay[];

  private readonly chunkManager_: ChunkManager;
  private readonly context_: IdetikContext;
  private readonly renderer_: Renderer;
  private readonly viewports_: Viewport[];
  private readonly stats_?: Stats;
  private readonly sizeObserver_: PixelSizeObserver;

  private lastAnimationId_?: number;
  private lastTimestamp_: DOMHighResTimeStamp = 0;

  /**
   * Creates an Idetik runtime for the given canvas.
   *
   * @param params - Configuration parameters for the Idetik instance
   * @param params.canvas - HTMLCanvasElement to render to
   * @param params.viewports - Optional array of viewport configurations.
   *   Each viewport renders with its own camera, layers, and controls.
   *   Elements and IDs must be unique across viewports.
   * @param params.overlays - Optional array of overlay objects that update each frame (e.g., for HUD elements)
   * @param params.showStats - Optional flag to display performance statistics
   *
   * @example
   * const canvas = document.querySelector('canvas')!;
   * const camera = new OrthographicCamera({
   *   left: 0,
   *   right: 1024,
   *   top: 0,
   *   bottom: 1024
   * });
   * const viewport = new Viewport({
   *   element: canvas,
   *   camera,
   *   layers: [imageLayer],
   *   cameraControls: new PanZoomControls(camera)
   * });
   * const idetik = new Idetik({ canvas, viewports: [viewport] });
   *
   * @throws {Error} If viewports have duplicate IDs or shared elements
   */
  constructor(params: IdetikProps) {
    this.canvas = params.canvas;

    this.renderer_ = new WebGLRenderer(this.canvas);
    const memoryLimitMB = params.memoryLimitMB ?? DEFAULT_MEMORY_LIMIT_MB;
    const memoryLimitBytes = memoryLimitMB * 1024 * 1024;
    this.chunkManager_ = new ChunkManager(
      (texture) => this.renderer_.uploadTexture(texture),
      (texture) => this.renderer_.disposeTexture(texture),
      () => this.renderer_.gpuTextureBytes,
      memoryLimitBytes,
      params.maxConcurrentRequests,
      params.maxGpuUploadsPerUpdate
    );
    this.context_ = {
      chunkManager: this.chunkManager_,
    };

    this.viewports_ = [...(params.viewports ?? [])];
    validateViewports(this.viewports_);
    const attached: Viewport[] = [];
    try {
      for (const viewport of this.viewports_) {
        viewport.attachToIdetik(this.context_);
        attached.push(viewport);
      }
    } catch (error) {
      for (const viewport of attached.reverse()) {
        viewport.detachFromIdetik();
      }
      throw error;
    }

    this.overlays = [...(params.overlays ?? [])];

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

  /** Counts of queued and in-flight chunk requests. */
  public get chunkQueueStats() {
    return this.chunkManager_.queueStats;
  }

  /** A snapshot of current CPU/GPU/JS heap memory usage. */
  public get memoryStats(): MemoryStats {
    const perf = (
      performance as Performance & {
        memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
      }
    ).memory;

    return {
      ...this.chunkManager_.memoryStats,
      gpuTextureBytes: this.renderer_.gpuTextureBytes,
      gpuTextureCount: this.renderer_.gpuTextureCount,
      jsHeapUsedBytes: perf?.usedJSHeapSize,
      jsHeapLimitBytes: perf?.jsHeapSizeLimit,
    };
  }

  /** The number of objects drawn in the last rendered frame. */
  public get renderedObjects() {
    return this.renderer_.renderedObjects;
  }

  /** The width of the rendering surface in pixels. */
  public get width() {
    return this.renderer_.width;
  }

  /** The height of the rendering surface in pixels. */
  public get height() {
    return this.renderer_.height;
  }

  /** The viewports in render order. */
  public get viewports(): readonly Viewport[] {
    return this.viewports_;
  }

  /** Whether the render loop is running. */
  public get running(): boolean {
    return this.lastAnimationId_ !== undefined;
  }

  public addViewport(viewport: Viewport): Viewport {
    validateNewViewport(viewport, this.viewports_);
    viewport.attachToIdetik(this.context_);
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

  /**
   * Removes a previously added viewport.
   *
   * @param viewport - The viewport to remove.
   * @returns `true` if the viewport was found and removed.
   */
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
    viewport.detachFromIdetik();
    Logger.info("Idetik", `Removed viewport "${viewport.id}"`);
    return true;
  }

  /**
   * Registers an overlay that updates once per frame.
   *
   * @param overlay - The overlay to add.
   */
  public addOverlay(overlay: Overlay): void {
    this.overlays.push(overlay);
  }

  /**
   * Removes a previously added overlay.
   *
   * @param overlay - The overlay to remove.
   * @returns `true` if the overlay was found and removed.
   */
  public removeOverlay(overlay: Overlay): boolean {
    const index = this.overlays.indexOf(overlay);
    if (index === -1) {
      Logger.warn("Idetik", "Overlay not found, nothing to remove");
      return false;
    }

    this.overlays.splice(index, 1);
    return true;
  }

  /**
   * Sets the memory budget for chunk data at runtime.
   *
   * @param memoryLimitMB - The new budget in megabytes.
   */
  public setMemoryLimitMB(memoryLimitMB: number): void {
    this.chunkManager_.memoryLimitBytes = memoryLimitMB * 1024 * 1024;
  }

  /**
   * Starts the render loop and connects input handlers.
   *
   * @returns The instance, for chaining.
   */
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

  /**
   * Stops the render loop and disconnects input handlers.
   */
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
