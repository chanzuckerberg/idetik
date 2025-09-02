import { Camera } from "./objects/cameras/camera";
import { Layer } from "./core/layer";
import { LayerManager } from "./core/layer_manager";
import { EventContext, EventDispatcher } from "./core/event_dispatcher";
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
import { Box2 } from "./math/box2";

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
  private needsResize_ = false;
  private readonly chunkManager_: ChunkManager;
  private readonly context_: IdetikContext;
  private readonly renderer_: WebGLRenderer;
  private readonly viewports_: Viewport[];
  public readonly canvas: HTMLCanvasElement;
  public readonly events: EventDispatcher;
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
    this.viewports_ = parseViewportConfigs(
      viewportConfigs,
      createLayerManager,
      canvas
    );

    this.overlays = params.overlays ?? [];

    if (params.showStats) this.stats_ = createStats();

    this.events = new EventDispatcher(canvas);
    this.events.addEventListener((event: EventContext) => {
      if (
        event.event instanceof PointerEvent ||
        event.event instanceof WheelEvent
      ) {
        const { clientX, clientY } = event.event;
        const client = vec2.fromValues(clientX, clientY);
        event.clipPos = this.clientToClip(client, 0);
        event.worldPos = this.camera.clipToWorld(event.clipPos);
      }
      for (const layer of this.layerManager.layers) {
        layer.onEvent(event);
        if (event.propagationStopped) return;
      }
      this.cameraControls?.onEvent(event);
    });
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

  // TEMP: backward-compatible getters/setter for camera, layerManager, and cameraControls
  // to be removed on completion of multi-viewport implementation
  public get camera() {
    return this.viewports_[0].camera;
  }

  public get layerManager() {
    return this.viewports_[0].layerManager;
  }

  public set cameraControls(controls: CameraControls | null) {
    this.viewports_[0].cameraControls = controls;
  }

  public get cameraControls() {
    return this.viewports_[0].cameraControls;
  }

  public clientToClip(position: vec2, depth: number = 0): vec3 {
    return this.viewports_[0].clientToClip(position, depth);
  }

  public start() {
    Logger.info("Idetik", "Idetik runtime started");
    this.startLayoutObservers();

    const render = (timestamp?: DOMHighResTimeStamp) => {
      if (this.stats_) this.stats_.begin();

      // Must resize before render b/c changing canvas coordinate space clears it.
      if (this.needsResize_) {
        this.updateSize();
      }

      const rendererBox = new Box2(
        vec2.fromValues(0, 0),
        vec2.fromValues(this.renderer_.width, this.renderer_.height)
      );
      for (const viewport of this.viewports_) {
        const viewportBox = viewport.getBoxRelativeToCanvas();
        if (!Box2.intersects(rendererBox, viewportBox)) {
          Logger.debug(
            "Idetik",
            `Viewport ${viewport.id} is entirely outside canvas bounds, skipping render`
          );
          continue;
        }
        if (viewport.camera.type === "OrthographicCamera") {
          const width = viewportBox.toRect().width;
          this.chunkManager_.update(
            viewport.camera as OrthographicCamera,
            width
          );
        }
        this.renderer_.render(viewport);
      }

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

  private startLayoutObservers() {
    const resizeObserver = new ResizeObserver(() => {
      this.needsResize_ = true;
    });

    resizeObserver.observe(this.canvas);
    for (const viewport of this.viewports_) {
      if (viewport.element !== this.canvas) {
        resizeObserver.observe(viewport.element);
      }
    }

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

  private updateSize() {
    this.renderer_.updateSize();
    for (const viewport of this.viewports_) {
      viewport.updateSize();
    }
    this.needsResize_ = false;
  }
}
