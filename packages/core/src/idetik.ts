import { Camera } from "./objects/cameras/camera";
import { Layer } from "./core/layer";
import { LayerManager } from "./core/layer_manager";
import { EventDispatcher } from "./core/event_dispatcher";
import { WebGLRenderer } from "./renderers/webgl_renderer";
import { CameraControls } from "./objects/cameras/controls";
import { Logger } from "./utilities/logger";
import { vec2, vec3 } from "gl-matrix";
import { OrthographicCamera } from "./objects/cameras/orthographic_camera";
import { createStats, type Stats } from "./utilities/stats";
import { Box2 } from "./math/box2";
import {
  Viewport,
  ViewportConfig,
  validateViewportConfigs,
} from "./core/viewport";
import { ChunkManager } from "./core/chunk_manager";

type Overlay = {
  update(idetik: Idetik, timestamp?: DOMHighResTimeStamp): void;
};

type IdetikParams = {
  canvas?: HTMLCanvasElement;
  canvasSelector?: string;

  camera?: Camera;
  cameraControls?: CameraControls;
  layers?: Layer[];

  viewports?: ViewportConfig[];

  overlays?: Overlay[];
  showStats?: boolean;
};

export type IdetikContext = {
  chunkManager: ChunkManager;
};

export class Idetik {
  private lastAnimationId_?: number;
  private needsResize_ = false;
  private readonly renderer_: WebGLRenderer;
  private readonly chunkManager_: ChunkManager;
  private readonly context_: IdetikContext;
  public readonly canvas: HTMLCanvasElement;
  public readonly events: EventDispatcher;
  public readonly overlays: Overlay[];
  private readonly viewports_: Viewport[];
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

    // Create shared context with single ChunkManager
    this.context_ = {
      chunkManager: this.chunkManager_,
    };

    if (!params.viewports && !params.camera) {
      throw new Error(
        "Either camera (single viewport) or viewports (multi viewport) must be provided"
      );
    }
    if (
      params.viewports &&
      (params.camera || params.layers || params.cameraControls)
    ) {
      throw new Error(
        "Cannot provide single viewport parameters (camera/layers/cameraControls) and viewports together"
      );
    }

    if (params.viewports) {
      // Validate multi-viewport configurations
      validateViewportConfigs(params.viewports);

      // Create viewports with LayerManagers
      this.viewports_ = params.viewports.map((config) => {
        const viewportId = config.id || config.element.id || "unnamed";
        const layerManager = new LayerManager(this.context_, viewportId);
        return new Viewport(config, layerManager);
      });
    } else {
      // Single viewport mode
      const layerManager = new LayerManager(this.context_, "main");
      this.viewports_ = [
        new Viewport(
          {
            id: "main",
            element: canvas,
            camera: params.camera!,
            layers: params.layers,
            cameraControls: params.cameraControls,
          },
          layerManager
        ),
      ];
    }

    this.overlays = params.overlays ?? [];

    if (params.showStats) this.stats_ = createStats();

    this.events = new EventDispatcher(canvas);

    // Set up viewport-based event handling
    this.events.setViewports(this.viewports_);
  }

  public get width() {
    return this.renderer_.width;
  }

  public get height() {
    return this.renderer_.height;
  }

  // delegate to an "active" or "main" viewport (currently first viewport)
  // for previously public camera/cameraControls/layerManager

  public set cameraControls(controls: CameraControls | undefined) {
    this.viewports_[0].cameraControls = controls;
  }

  public get camera(): Camera {
    return this.viewports_[0].camera;
  }

  public get layerManager(): LayerManager {
    return this.viewports_[0].layerManager;
  }

  public clientToClip(position: vec2, depth: number = 0): vec3 {
    const [x, y] = position;
    const rect = this.canvas.getBoundingClientRect();
    return vec3.fromValues(
      (2 * (x - rect.x)) / this.canvas.clientWidth - 1,
      (2 * (y - rect.y)) / this.canvas.clientHeight - 1,
      depth
    );
  }

  public start() {
    Logger.info("Idetik", "Idetik runtime started");
    this.startSizeObservers();

    const render = (timestamp?: DOMHighResTimeStamp) => {
      if (this.stats_) this.stats_.begin();

      // Must resize before render b/c changing canvas coordinate space clears it.
      if (this.needsResize_) {
        this.renderer_.updateSize();
        this.needsResize_ = false;
      }

      const canvasBox = this.getCanvasBox();
      for (const viewport of this.viewports_) {
        // single viewport mode
        if (viewport.element == this.canvas) {
          if (viewport.camera.type === "OrthographicCamera") {
            this.chunkManager_.update(
              viewport.camera as OrthographicCamera,
              this.renderer_.width
            );
          }
          this.renderer_.render(viewport.layerManager, viewport.camera);
          continue;
        }

        const viewportBox = viewport.calculateViewportBox(this.canvas);
        if (Box2.intersects(viewportBox, canvasBox)) {
          if (viewport.camera.type === "OrthographicCamera") {
            const width = viewportBox.max[0] - viewportBox.min[0];
            this.chunkManager_.update(
              viewport.camera as OrthographicCamera,
              width
            );
          }

          this.renderer_.render(
            viewport.layerManager,
            viewport.camera,
            viewportBox
          );
        }
      }

      // TODO: overlays may need to be attached to specific viewports
      for (const overlay of this.overlays) {
        overlay.update(this, timestamp);
      }

      if (this.stats_) this.stats_.end();
      this.lastAnimationId_ = requestAnimationFrame(render);
    };
    render();
    return this;
  }

  public stop() {
    if (this.lastAnimationId_ !== undefined) {
      cancelAnimationFrame(this.lastAnimationId_);
    }
  }

  private startSizeObservers() {
    new ResizeObserver(() => {
      this.needsResize_ = true;
    }).observe(this.canvas);

    const startDevicePixelRatioObserver = () => {
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

  private getCanvasBox(): Box2 {
    return new Box2(
      vec2.fromValues(0, 0),
      vec2.fromValues(this.canvas.width, this.canvas.height)
    );
  }
}
