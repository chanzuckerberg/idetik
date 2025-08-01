import { Camera } from "./objects/cameras/camera";
import { Layer } from "./core/layer";
import { LayerManager } from "./core/layer_manager";
import { EventContext, EventDispatcher } from "./core/event_dispatcher";
import { WebGLRenderer } from "./renderers/webgl_renderer";
import { CameraControls } from "./objects/cameras/controls";
import { Logger } from "./utilities/logger";
import { ChunkManager } from "./core/chunk_manager";
import { vec2, vec3 } from "gl-matrix";

type Overlay = {
  update(idetik: Idetik, timestamp?: DOMHighResTimeStamp): void;
};

type IdetikParams = {
  canvas?: HTMLCanvasElement;
  canvasSelector?: string;
  camera: Camera;
  controls?: CameraControls;
  layers?: Layer[];
  overlays?: Overlay[];
};

export type IdetikContext = {
  chunkManager: ChunkManager;
};

export class Idetik {
  public layerManager: LayerManager;
  public camera: Camera;
  public readonly canvas: HTMLCanvasElement;
  public readonly overlays: Overlay[];
  private readonly eventDispatcher_: EventDispatcher;
  private readonly renderer_: WebGLRenderer;
  private readonly context_: IdetikContext;
  private readonly chunkManager_: ChunkManager;
  private lastAnimationId_?: number;
  private needsResize_ = false;

  constructor(params: IdetikParams) {
    if (!params.canvas && !params.canvasSelector) {
      throw new Error("Either canvas or canvasSelector must be provided");
    }
    if (params.canvas && params.canvasSelector) {
      throw new Error("Cannot provide both canvas and canvasSelector");
    }

    this.camera = params.camera;
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
    this.layerManager = new LayerManager(this.context_);

    if (params.controls) {
      // TODO: move controls to the idetik class
      this.renderer_.setControls(params.controls);
    }

    if (params.layers) {
      for (const layer of params.layers) {
        this.layerManager.add(layer);
      }
    }

    this.overlays = params.overlays ?? [];

    this.eventDispatcher_ = new EventDispatcher(canvas);
    this.eventDispatcher_.addEventListener((event: EventContext) => {
      if (event.event instanceof PointerEvent) {
        const client = vec2.fromValues(
          event.event.clientX,
          event.event.clientY
        );
        Object.defineProperties(event, {
          clipPos: {
            get: () => this.clientToClip(client, 0),
            configurable: true,
          },
          worldPos: {
            get: () => this.camera.clipToWorld(this.clientToClip(client, 0)),
            configurable: true,
          },
        });
      }
      for (const layer of this.layerManager.layers) {
        layer.onEvent(event);
        if (event.propagationStopped) return;
      }
      // TODO: pass event to camera controls if needed
    });
  }

  public get width() {
    return this.renderer_.width;
  }

  public get height() {
    return this.renderer_.height;
  }

  // TODO: this should be modified once the controls are moved to the idetik class
  public setControls(controls: CameraControls) {
    this.renderer_.setControls(controls);
  }

  // TODO: this can be moved directly to this class, but will need access to (and possibly expose)
  // the canvas element
  // let's do it at the same time `setControls` is moved to this class
  public clientToClip(position: vec2, depth: number = 0): vec3 {
    return this.renderer_.clientToClip(position, depth);
  }

  public start() {
    Logger.info("Idetik", "Idetik runtime started");
    new ResizeObserver(() => {
      this.needsResize_ = true;
    }).observe(this.canvas);
    const render = (timestamp?: DOMHighResTimeStamp) => {
      if (!this.camera) {
        Logger.warn(
          "Idetik",
          "A camera must be set before starting the Idetik runtime"
        );
        return;
      }
      this.chunkManager_.update(
        this.camera,
        this.renderer_.width,
        this.renderer_.height
      );
      // Must resize before render b/c changing canvas coordinate space clears it.
      if (this.needsResize_) {
        this.renderer_.updateSize();
        this.needsResize_ = false;
      }
      this.renderer_.render(this.layerManager, this.camera);
      for (const overlay of this.overlays) {
        overlay.update(this, timestamp);
      }
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
