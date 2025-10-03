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
  private resizeObserver_?: ResizeObserver;
  private mediaQuery_?: MediaQueryList;
  private onMediaQueryChange_?: (this: MediaQueryList, ev: MediaQueryListEvent) => void;
  private needsResize_ = false;
  private readonly chunkManager_: ChunkManager;
  private readonly context_: IdetikContext;
  private readonly renderer_: WebGLRenderer;
  private readonly viewports_: Viewport[];
  public readonly canvas: HTMLCanvasElement;
  public readonly overlays: Overlay[];
  private readonly stats_?: Stats;

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
      this.startLayoutObservers();
      this.animate();
    } else {
      Logger.warn("Idetik", "Idetik runtime already started");
    }
    return this;
  }

  private animate(timestamp?: DOMHighResTimeStamp) {
    if (this.stats_) this.stats_.begin();

    // Must resize before render b/c changing canvas coordinate space clears it.
    if (this.needsResize_) {
      this.updateSize();
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
    if (this.lastAnimationId_ !== undefined) {
      Logger.debug(
        "Idetik",
        "Cancelling animation frame",
        this.lastAnimationId_
      );
      this.stopLayoutObservers();
      cancelAnimationFrame(this.lastAnimationId_);
      this.lastAnimationId_ = undefined;
    }
  }

  private startLayoutObservers() {
    this.resizeObserver_ = new ResizeObserver(() => {
      this.needsResize_ = true;
    });

    this.resizeObserver_.observe(this.canvas);
    for (const viewport of this.viewports_) {
      if (viewport.element !== this.canvas) {
        this.resizeObserver_.observe(viewport.element);
      }
    }

    const startDevicePixelRatioObserver = () => {
      // this media query needs to be updated after a change is detected, so we use a one-time
      // event listener that re-registers itself with the new value
      // https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio#monitoring_screen_resolution_or_zoom_level_changes
      const mediaQuery = matchMedia(
        `(resolution: ${window.devicePixelRatio}dppx)`
      );
      mediaQuery.addEventListener(
        "change",
        () => {
          this.needsResize_ = true;
          startDevicePixelRatioObserver();
        },
        { once: true }
      );
    };
    startDevicePixelRatioObserver();
  }

  private startDevicePixelRatioObserver() {
    // this media query needs to be updated after a change is detected, so we use a one-time
    // event listener that re-registers itself with the new value
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio#monitoring_screen_resolution_or_zoom_level_changes
    this.mediaQuery_ = matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`
    );
    this.onMediaQueryChange_ = () => {
      this.needsResize_ = true;
      this.startDevicePixelRatioObserver();
    };
    this.mediaQuery_.addEventListener("change", this.onMediaQueryChange_, {once: true});
  }

  private stopLayoutObservers() {
    this.resizeObserver_?.disconnect();
    this.mediaQuery_?.removeEventListener("change", this.onMediaQueryChange_!);
  }

  private updateSize() {
    this.renderer_.updateSize();
    for (const viewport of this.viewports_) {
      viewport.updateSize();
    }
    this.needsResize_ = false;
  }
}
