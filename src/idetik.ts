import { WebGLRenderer } from "./renderers/webgl_renderer";
import { Logger } from "./utilities/logger";
import { ChunkManager } from "./data/chunk_manager";
import { ImageLayer } from "./layers/image_layer";
import { LabelLayer } from "./layers/label_layer";
import { VolumeLayer } from "./layers/volume_layer";
import {
  computeViewportChunkStats,
  type ChunkStats,
  type ViewportChunkStats,
} from "./data/chunk_stats";
import { Renderer } from "./core/renderer";
import { createStats, type Stats } from "./utilities/stats";
import {
  parseViewportProps,
  validateNewViewport,
  Viewport,
  ViewportProps,
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
 * How the runtime schedules frames.
 *
 * - `"continuous"` updates and draws every animation frame.
 * - `"manual"` draws only when {@link Idetik.requestRender} is called. Frames
 *   still run, without drawing, while {@link Idetik.whenSettled} waits for
 *   loading or loaded chunks await upload, then the loop goes idle. Camera
 *   controls are not animated, so this suits non-interactive rendering such
 *   as thumbnails:
 *
 *   ```ts
 *   await idetik.whenSettled();
 *   await idetik.requestRender();
 *   ```
 */
export type RenderMode = "continuous" | "manual";

/**
 * Initialization properties for constructing an Idetik instance.
 */
export type IdetikProps = {
  /** The canvas element to render into. */
  canvas: HTMLCanvasElement;
  /** Viewport definitions to create at startup. */
  viewports?: ViewportProps[];
  /** Overlays to run each frame. */
  overlays?: Overlay[];
  /** Shows an FPS meter. Defaults to `false`. */
  showStats?: boolean;
  /** Memory budget for chunk data. Defaults to `2048`. */
  memoryLimitMB?: number;
  /** Max in-flight chunk requests. Defaults to `8`. */
  maxConcurrentRequests?: number;
  /** Max GPU texture uploads per frame. Defaults to `4`. */
  maxGpuUploadsPerUpdate?: number;
  /** How frames are scheduled; see {@link RenderMode}. Defaults to `"continuous"`. */
  renderMode?: RenderMode;
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

  private readonly renderMode_: RenderMode;
  private running_ = false;
  // Set by anything that needs a draw; consumed by the next frame.
  private needsDraw_ = false;
  // Set while a frame runs, and when the loop resumes from idle (so the first
  // frame's dt is 0 rather than the idle gap).
  private inFrame_ = false;
  private resumed_ = false;
  private drawWaiters_: Array<() => void> = [];
  private settleWaiters_: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];

  /**
   * Creates an Idetik runtime for the given canvas.
   *
   * @param params - Initialization properties.
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
    this.renderMode_ = params.renderMode ?? "continuous";

    this.viewports_ = parseViewportProps(
      params.viewports ?? [],
      this.canvas,
      this.context_
    );
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
      const draw = this.renderMode_ === "continuous";
      if (draw) this.renderer_.beginFrame();
      for (const viewport of this.viewports_) {
        viewport.updateSize();
        if (draw) this.renderer_.render(viewport);
      }
    });
  }

  /** Counts of queued and in-flight chunk requests and pending uploads. */
  public get chunkQueueStats() {
    return this.chunkManager_.queueStats;
  }

  /**
   * Chunk demand and GPU residency per source, by timepoint, and loading
   * progress per viewport. Each read walks every view's chunk states and returns a
   * new snapshot, so poll it at the rate you need rather than every frame.
   */
  public get chunkStats(): ChunkStats {
    const viewports: ViewportChunkStats[] = [];
    for (const viewport of this.viewports_) {
      const views = [];
      for (const layer of viewport.layers) {
        // TODO: replace with a generic hook once non-image chunked layers
        // (e.g. meshes, point clouds) exist
        if (
          !(layer instanceof ImageLayer) &&
          !(layer instanceof LabelLayer) &&
          !(layer instanceof VolumeLayer)
        ) {
          continue;
        }
        if (layer.chunkStoreView) views.push(layer.chunkStoreView);
      }
      if (views.length === 0) continue;
      viewports.push(computeViewportChunkStats(viewport.id, views));
    }
    return { sources: this.chunkManager_.sourceChunkStats, viewports };
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

  /** Whether the render loop is running (started, even if idle in manual mode). */
  public get running(): boolean {
    return this.running_;
  }

  /** How frames are scheduled; see {@link RenderMode}. */
  public get renderMode(): RenderMode {
    return this.renderMode_;
  }

  /**
   * Draws the next frame with whatever data is loaded. In manual mode this is
   * the only way to draw. Harmless in continuous mode.
   *
   * @returns A promise resolved once the frame has been drawn, or
   *   immediately if the runtime isn't running.
   */
  public requestRender(): Promise<void> {
    if (!this.running_) return Promise.resolve();
    const drawn = new Promise<void>((resolve) =>
      this.drawWaiters_.push(resolve)
    );
    this.needsDraw_ = true;
    this.scheduleFrame();
    return drawn;
  }

  /**
   * Waits until loading has come to rest: no chunk requests queued or in
   * flight, no loaded chunks awaiting upload, and no camera controls moving.
   * Chunks that don't fit the memory budget are never requested, so they
   * don't hold it up, but failed requests are retried, so a chunk that keeps
   * failing does; pass a timeout to bound the wait. In manual mode this
   * drives loading without drawing; follow it with {@link requestRender} to
   * draw the result.
   *
   * @param options - `timeoutMs` rejects the promise if loading hasn't
   *   settled in time. Loading continues regardless.
   * @returns A promise resolved once settled. It rejects if loading settles
   *   with visible chunks at a layer's current LOD still not resident (e.g.
   *   over the memory budget), on timeout, or if the runtime isn't running or
   *   stops first.
   */
  public whenSettled(options?: { timeoutMs?: number }): Promise<void> {
    if (!this.running_) {
      return Promise.reject(new Error("Idetik runtime is not running"));
    }
    const timeoutMs = options?.timeoutMs;
    const settled = new Promise<void>((resolve, reject) => {
      const waiter = { resolve, reject };
      this.settleWaiters_.push(waiter);
      if (timeoutMs === undefined) return;
      setTimeout(() => {
        const index = this.settleWaiters_.indexOf(waiter);
        if (index === -1) return;
        this.settleWaiters_.splice(index, 1);
        reject(new Error(`Loading did not settle within ${timeoutMs} ms`));
      }, timeoutMs);
    });
    this.scheduleFrame();
    return settled;
  }

  /**
   * Finds a viewport by its id.
   *
   * @param id - The id given in the viewport's definition.
   * @returns The matching viewport or `undefined` if none matches.
   */
  public getViewport(id: string): Viewport | undefined {
    return this.viewports_.find((v) => v.id === id);
  }

  /**
   * Adds a viewport at runtime.
   *
   * @param props - The viewport definition. The `element` defaults to the
   *   canvas and must be unique across viewports.
   * @returns The created viewport.
   */
  public addViewport(props: ViewportProps): Viewport {
    const [viewport] = parseViewportProps([props], this.canvas, this.context_);

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
      this.running_ = true;
      for (const viewport of this.viewports_) {
        viewport.events.connect();
      }
      this.sizeObserver_.connect();

      this.scheduleFrame();
    } else {
      Logger.warn("Idetik", "Idetik runtime already started");
    }
    return this;
  }

  /**
   * Requests an animation frame unless one is already pending. In manual mode
   * the frame only draws if a render was requested.
   */
  private scheduleFrame() {
    if (!this.running_ || this.lastAnimationId_ !== undefined) return;
    // Outside a frame, the loop was idle (or just started).
    if (!this.inFrame_) this.resumed_ = true;
    this.lastAnimationId_ = requestAnimationFrame((timestamp) =>
      this.animate(timestamp)
    );
  }

  private animate(timestamp: DOMHighResTimeStamp) {
    this.lastAnimationId_ = undefined;
    this.inFrame_ = true;
    if (this.stats_) this.stats_.begin();

    if (this.resumed_) {
      this.resumed_ = false;
      this.lastTimestamp_ = timestamp;
    }
    // cap dt to prevent large time-step jumps when resuming from background tabs
    const dt = Math.min(timestamp - this.lastTimestamp_, 100) / 1000;

    this.lastTimestamp_ = timestamp;

    const continuous = this.renderMode_ === "continuous";
    // Draw waiters registered before this frame are resolved by its draw.
    const drawWaiters = this.drawWaiters_;
    this.drawWaiters_ = [];
    const drew = continuous || this.needsDraw_;
    this.needsDraw_ = false;
    let moving = false;

    if (continuous) {
      for (const viewport of this.viewports_) {
        viewport.cameraControls?.onUpdate(dt);
        if (viewport.cameraControls?.isMoving) moving = true;
      }
    }
    for (const viewport of this.viewports_) {
      this.renderer_.updateLayers(viewport);
    }
    // Upload after updating layers so this frame's requests are queued; the
    // layers pick up the uploads when they next update.
    this.chunkManager_.update();
    if (drew) {
      this.renderer_.beginFrame();
      for (const viewport of this.viewports_) {
        this.renderer_.draw(viewport);
      }
      for (const overlay of this.overlays) {
        overlay.update(this);
      }
      for (const resolve of drawWaiters) resolve();
    }

    const queue = this.chunkManager_.queueStats;
    const settled =
      !moving &&
      queue.awaitingUpload === 0 &&
      queue.pending === 0 &&
      queue.running === 0;
    if (settled && this.settleWaiters_.length > 0) {
      const settleWaiters = this.settleWaiters_;
      this.settleWaiters_ = [];
      const incomplete = this.chunkStats.viewports.filter(
        ({ current }) => current.resident < current.requested
      );
      if (incomplete.length === 0) {
        for (const { resolve } of settleWaiters) resolve();
      } else {
        const error = new Error(
          `Loading settled with visible chunks missing in viewport(s) ` +
            incomplete.map((v) => `"${v.viewportId}"`).join(", ")
        );
        for (const { reject } of settleWaiters) reject(error);
      }
    }

    if (this.stats_) this.stats_.end();

    // In manual mode, keep going only while there's work this loop must
    // drive; whenSettled polls until loading settles.
    if (
      continuous ||
      queue.awaitingUpload > 0 ||
      this.needsDraw_ ||
      this.settleWaiters_.length > 0
    ) {
      this.scheduleFrame();
    }
    this.inFrame_ = false;
  }

  /**
   * Stops the render loop and disconnects input handlers. Pending
   * {@link requestRender} promises resolve and {@link whenSettled} promises
   * reject.
   */
  public stop() {
    Logger.info("Idetik", "Idetik runtime stopping");
    if (!this.running) {
      Logger.warn("Idetik", "Idetik runtime not started");
    } else {
      this.running_ = false;
      this.sizeObserver_.disconnect();
      for (const viewport of this.viewports_) {
        viewport.events.disconnect();
      }
      if (this.lastAnimationId_ !== undefined) {
        cancelAnimationFrame(this.lastAnimationId_);
        this.lastAnimationId_ = undefined;
      }
      const drawWaiters = this.drawWaiters_;
      const settleWaiters = this.settleWaiters_;
      this.drawWaiters_ = [];
      this.settleWaiters_ = [];
      for (const resolve of drawWaiters) resolve();
      const error = new Error("Idetik runtime stopped before settling");
      for (const { reject } of settleWaiters) reject(error);
    }
  }
}
