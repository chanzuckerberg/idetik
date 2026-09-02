import { WebGLRenderer } from "./renderers/webgl_renderer";
import { Logger } from "./utilities/logger";
import { ChunkManager } from "./data/chunk_manager";
import { Renderer } from "./core/renderer";
import { createStats, type Stats } from "./utilities/stats";
import { Viewport } from "./core/viewport";
import { Layer } from "./core/layer";
import { PixelSizeObserver } from "./utilities/pixel_size_observer";

const DEFAULT_MEMORY_LIMIT_MB = 2048;

/** @group Runtime */
export type Overlay = {
  update(idetik: Idetik): void;
};

/** @inline */
type IdetikProps = {
  canvas: HTMLCanvasElement;
  viewports?: Viewport[];
  overlays?: Overlay[];
  showStats?: boolean;
  memoryLimitMB?: number;
  maxConcurrentRequests?: number;
  maxGpuUploadsPerUpdate?: number;
};

export type IdetikContext = {
  chunkManager: ChunkManager;
};

// JS heap usage from the non-standard performance.memory API.
// Chromium only, undefined where the API is unavailable.
/** @group Runtime */
export type MemoryStats = {
  cpuChunkBytes: number;
  cpuChunkCount: number;
  gpuTextureBytes: number;
  gpuTextureCount: number;
  jsHeapUsedBytes?: number;
  jsHeapLimitBytes?: number;
};

function validateViewport(
  viewport: Viewport,
  existingViewports: readonly Viewport[]
): void {
  for (const existing of existingViewports) {
    if (existing.id === viewport.id) {
      throw new Error(
        `Duplicate viewport ID "${viewport.id}". Each viewport must have a unique ID.`
      );
    }
    if (existing.domElement === viewport.domElement) {
      const elementDescription =
        viewport.domElement.tagName.toLowerCase() +
        (viewport.domElement.id
          ? `#${viewport.domElement.id}`
          : "[element has no id]");
      throw new Error(
        "Multiple viewports cannot share the same HTML element: " +
          `viewports "${existing.id}" and "${viewport.id}" both use ${elementDescription}`
      );
    }
  }

  const existingLayers = new Set(
    existingViewports.flatMap((existing) => existing.layers)
  );
  for (const layer of viewport.layers) {
    if (existingLayers.has(layer)) {
      throw new Error(
        `${layer.type} cannot be shared by multiple viewports simultaneously.`
      );
    }
    existingLayers.add(layer);
  }
}

function validateViewports(viewports: readonly Viewport[]): void {
  for (let i = 0; i < viewports.length; i++) {
    validateViewport(viewports[i], viewports.slice(0, i));
  }
}

/**
 * The top-level entry point for an Idetik visualization.
 *
 * An `Idetik` instance owns the renderer, the shared chunk manager, and one or
 * more viewports. Each viewport pairs a camera, its controls, and a stack of
 * layers and draws into a region of the canvas. Call {@link Idetik.start} to
 * begin the render loop and {@link Idetik.stop} to halt it.
 *
 * @see {@link Layer} for the data layers rendered within a viewport.
 *
 * @group Runtime
 */
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
   *   domElement: canvas,
   *   camera,
   *   layers: [imageLayer],
   *   cameraControls: new PanZoomControls(camera)
   * });
   * const idetik = new Idetik({ canvas, viewports: [viewport] });
   *
   * @throws {Error} If viewports have duplicate IDs, shared elements, or shared layers
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

    this.overlays = [...(params.overlays ?? [])];

    if (params.showStats) this.stats_ = createStats();

    const sizeDependents: HTMLElement[] = [this.canvas];
    for (const viewport of this.viewports_) {
      if (viewport.domElement !== this.canvas) {
        sizeDependents.push(viewport.domElement);
      }
    }
    this.sizeObserver_ = new PixelSizeObserver(sizeDependents, () => {
      validateViewports(this.viewports_);
      this.renderer_.updateSize();
      this.renderer_.beginFrame();
      for (const viewport of this.viewports_) {
        viewport.updateSize();
        this.renderViewport(viewport);
      }
    });
  }

  public get chunkQueueStats() {
    return this.chunkManager_.queueStats;
  }

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

  public addViewport(viewport: Viewport): Viewport {
    validateViewport(viewport, this.viewports_);
    this.viewports_.push(viewport);

    if (this.running) {
      viewport.events.connect();
      if (viewport.domElement !== this.canvas) {
        this.sizeObserver_.observe(viewport.domElement);
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
      if (viewport.domElement !== this.canvas) {
        this.sizeObserver_.unobserve(viewport.domElement);
      }
    }

    this.viewports_.splice(index, 1);
    for (const layer of viewport.layers) {
      if (layer.isAttachedTo(this.context_, viewport)) {
        layer.onDetached(viewport);
      }
    }
    Logger.info("Idetik", `Removed viewport "${viewport.id}"`);
    return true;
  }

  public addOverlay(overlay: Overlay): void {
    this.overlays.push(overlay);
  }

  public removeOverlay(overlay: Overlay): boolean {
    const index = this.overlays.indexOf(overlay);
    if (index === -1) {
      Logger.warn("Idetik", "Overlay not found, nothing to remove");
      return false;
    }

    this.overlays.splice(index, 1);
    return true;
  }

  public setMemoryLimitMB(memoryLimitMB: number): void {
    this.chunkManager_.memoryLimitBytes = memoryLimitMB * 1024 * 1024;
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

  private renderViewport(viewport: Viewport): void {
    const layersToAttach: Layer[] = [];
    for (const layer of viewport.layers) {
      if (layer.attached) {
        if (!layer.isAttachedTo(this.context_, viewport)) {
          throw new Error(
            `${layer.type} is already attached to another viewport or Idetik runtime.`
          );
        }
      } else {
        layersToAttach.push(layer);
      }
    }

    const attachedLayers: Layer[] = [];
    try {
      for (const layer of layersToAttach) {
        layer.onAttached(this.context_, viewport);
        attachedLayers.push(layer);
      }
    } catch (error) {
      for (const layer of attachedLayers.reverse()) layer.onDetached(viewport);
      throw error;
    }

    this.renderer_.render(viewport);
  }

  private animate(timestamp: DOMHighResTimeStamp) {
    if (this.stats_) this.stats_.begin();

    // cap dt to prevent large time-step jumps when resuming from background tabs
    const dt = Math.min(timestamp - this.lastTimestamp_, 100) / 1000;

    this.lastTimestamp_ = timestamp;
    validateViewports(this.viewports_);

    this.renderer_.beginFrame();
    for (const viewport of this.viewports_) {
      viewport.cameraControls?.onUpdate(dt);
      this.renderViewport(viewport);
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
