import { LayerManager } from "./core/layer_manager";
import { WebGLRenderer } from "./renderers/webgl_renderer";
import { Logger } from "./utilities/logger";
import { ChunkManager } from "./core/chunk_manager";
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
  canvas?: HTMLCanvasElement;
  canvasSelector?: string;
  /** Viewport configurations. For single viewport, pass array with one element. */
  viewports: ViewportConfig[];
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

  constructor(params: IdetikParams) {
    // Validate canvas parameters
    if (!params.canvas && !params.canvasSelector) {
      throw new Error("Either canvas or canvasSelector must be provided");
    }
    if (params.canvas && params.canvasSelector) {
      throw new Error("Cannot provide both canvas and canvasSelector");
    }

    const canvas =
      params.canvas ??
      document.querySelector<HTMLCanvasElement>(params.canvasSelector!);
    if (!canvas) {
      throw new Error(`Canvas not found: ${params.canvasSelector}`);
    }
    this.canvas = canvas;

    // Validate viewport parameters
    if (!params.viewports || params.viewports.length === 0) {
      throw new Error("At least one viewport must be provided");
    }

    this.renderer_ = new WebGLRenderer(canvas);
    this.chunkManager_ = new ChunkManager();
    this.context_ = {
      chunkManager: this.chunkManager_,
    };

    // Create layer managers with shared context
    const createLayerManager = () => new LayerManager(this.context_);
    this.viewports_ = parseViewportConfigs(
      params.viewports,
      canvas,
      createLayerManager
    );

    this.overlays = params.overlays ?? [];

    if (params.showStats) this.stats_ = createStats();

    // Track all elements that need size observation
    const sizeDependents: HTMLElement[] = [this.canvas];
    for (const viewport of this.viewports_) {
      if (viewport.element !== this.canvas) {
        sizeDependents.push(viewport.element);
      }
    }
    this.sizeObserver_ = new PixelSizeObserver(sizeDependents);
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

  /**
   * Get all viewports managed by this Idetik instance.
   */
  public get viewports(): readonly Viewport[] {
    return this.viewports_;
  }

  /**
   * Get a viewport by ID. Returns undefined if not found.
   */
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

    // Update chunk manager before rendering to process all views
    this.chunkManager_.update();

    for (const viewport of this.viewports_) {
      this.renderer_.render(viewport);
    }

    // Process chunk load queue after all layers have updated
    this.chunkManager_.flush();

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
