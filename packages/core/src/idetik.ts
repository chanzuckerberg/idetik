import { Camera } from "./objects/cameras/camera";
import { Layer } from "./core/layer";
import { LayerManager } from "./core/layer_manager";
import { WebGLRenderer } from "./renderers/webgl_renderer";
import { CameraControls } from "./objects/cameras/controls";
import { Logger } from "./utilities/logger";
import { ChunkManager } from "./core/chunk_manager";
import { vec2, vec3 } from "gl-matrix";
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
  canvas?: HTMLCanvasElement;
  canvasSelector?: string;
  camera: Camera;
  cameraControls?: CameraControls;
  layers?: Layer[];
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
  private readonly pixelSizeObserver_: PixelSizeObserver;

  constructor(params: IdetikParams) {
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

    this.renderer_ = new WebGLRenderer(canvas);
    this.chunkManager_ = new ChunkManager();
    this.context_ = {
      chunkManager: this.chunkManager_,
    };

    // TEMP: creating a single viewport for now to maintain the existing API
    const viewportConfigs: ViewportConfig[] = [
      {
        id: "main",
        element: canvas,
        camera: params.camera,
        layers: params.layers,
        cameraControls: params.cameraControls,
      },
    ];
    // TEMP: pass closure to reuse the main LayerManager instead of creating new ones
    // This avoids circular import issues while maintaining shared context
    const createLayerManager = () => new LayerManager(this.context_);
    this.viewports_ = parseViewportConfigs(viewportConfigs, createLayerManager);

    this.overlays = params.overlays ?? [];

    if (params.showStats) this.stats_ = createStats();

    this.pixelSizeObserver_ = new PixelSizeObserver();
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

  // TEMP: backward-compatible getters/setter for events, camera, layerManager, and cameraControls
  // to be removed on completion of multi-viewport implementation
  public get events() {
    return this.viewports_[0].events;
  }

  public get camera() {
    return this.viewports_[0].camera;
  }

  public get layerManager() {
    return this.viewports_[0].layerManager;
  }

  public set cameraControls(controls: CameraControls | undefined) {
    this.viewports_[0].cameraControls = controls;
  }

  public clientToClip(position: vec2, depth: number = 0): vec3 {
    return this.viewports_[0].clientToClip(position, depth);
  }

  public start() {
    Logger.info("Idetik", "Idetik runtime starting");
    if (this.lastAnimationId_ === undefined) {
      const elements: HTMLElement[] = [this.canvas];
      for (const viewport of this.viewports_) {
        if (viewport.element !== this.canvas) {
          elements.push(viewport.element);
        }
        viewport.events.connect();
      }
      this.pixelSizeObserver_.start(elements);
      this.animate();
    } else {
      Logger.warn("Idetik", "Idetik runtime already started");
    }
    return this;
  }

  private animate(timestamp?: DOMHighResTimeStamp) {
    if (this.stats_) this.stats_.begin();

    // Must resize before render b/c changing canvas coordinate space clears it.
    if (this.pixelSizeObserver_.changed) {
      this.updateSize();
      this.pixelSizeObserver_.changed = false;
    }

    for (const viewport of this.viewports_) {
      if (viewport.camera.type === "OrthographicCamera") {
        this.chunkManager_.update(
          viewport.camera as OrthographicCamera,
          viewport.getBoxRelativeTo(this.canvas).toRect().width
        );
      }
      this.renderer_.render(viewport);
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
      this.pixelSizeObserver_.stop();
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
