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
  parseViewportConfigs,
} from "./core/viewport";

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

export class Idetik {
  private lastAnimationId_?: number;
  private needsResize_ = false;
  private readonly renderer_: WebGLRenderer;
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

    this.viewports_ = params.viewports
      ? parseViewportConfigs(params.viewports)
      : [
          new Viewport({
            id: "main",
            element: canvas,
            camera: params.camera!,
            layers: params.layers,
            cameraControls: params.cameraControls,
          }),
        ];

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

  public set cameraControls(controls: CameraControls | undefined) {
    if (this.viewports_.length > 0) {
      this.viewports_[0].cameraControls = controls;
    }
  }

  // Delegate to active/main viewport (currently first viewport)
  public get camera(): Camera {
    return this.viewports_[0].camera;
  }

  public get layerManager(): LayerManager {
    // Always return the first viewport's persistent layer manager
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

  private getCanvasBox(): Box2 {
    // Canvas width/height are already in device pixels
    return new Box2(
      vec2.fromValues(0, 0),
      vec2.fromValues(this.canvas.width, this.canvas.height)
    );
  }

  public start() {
    Logger.info("Idetik", "Idetik runtime started");
    new ResizeObserver(() => {
      this.needsResize_ = true;
    }).observe(this.canvas);

    // Listen for device pixel ratio changes (when moving between screens)
    const startDevicePixelRatioObserver = () => {
      const mediaQuery = matchMedia(
        `(resolution: ${window.devicePixelRatio}dppx)`
      );
      mediaQuery.addEventListener(
        "change",
        () => {
          this.needsResize_ = true;
          startDevicePixelRatioObserver(); // Re-setup listener for new ratio
        },
        { once: true }
      );
    };
    startDevicePixelRatioObserver();
    const render = (timestamp?: DOMHighResTimeStamp) => {
      if (this.stats_) this.stats_.begin();

      // Must resize before render b/c changing canvas coordinate space clears it.
      if (this.needsResize_) {
        this.renderer_.updateSize();
        this.needsResize_ = false;
      }

      this.renderer_.clear();

      const canvasBox = this.getCanvasBox();
      for (const viewport of this.viewports_) {
        // single viewport mode
        if (viewport.element == this.canvas) {
          if (viewport.camera.type === "OrthographicCamera") {
            viewport.chunkManager.update(
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
            viewport.chunkManager.update(
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
}
