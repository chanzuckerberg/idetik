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
  private cameraControls_?: CameraControls;
  private lastAnimationId_?: number;
  private needsResize_ = false;
  private readonly chunkManager_: ChunkManager;
  private readonly context_: IdetikContext;
  private readonly renderer_: WebGLRenderer;
  public camera: Camera;
  public layerManager: LayerManager;
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

    this.camera = params.camera;
    this.cameraControls_ = params.cameraControls;
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

    if (params.layers) {
      for (const layer of params.layers) {
        this.layerManager.add(layer);
      }
    }

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
      this.cameraControls_?.onEvent(event);
    });
  }

  public get width() {
    return this.renderer_.width;
  }

  public get height() {
    return this.renderer_.height;
  }

  public set cameraControls(controls: CameraControls | undefined) {
    this.cameraControls_ = controls;
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
    if (this.lastAnimationId_ === undefined) {
      new ResizeObserver(() => {
        this.needsResize_ = true;
      }).observe(this.canvas);
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
      this.renderer_.updateSize();
      this.needsResize_ = false;
    }

    if (this.camera.type === "OrthographicCamera") {
      this.chunkManager_.update(
        this.camera as OrthographicCamera,
        this.renderer_.width
      );
    }

    this.renderer_.render(this.layerManager, this.camera);
    for (const overlay of this.overlays) {
      overlay.update(this, timestamp);
    }

    if (this.stats_) this.stats_.end();

    this.lastAnimationId_ = requestAnimationFrame((timestamp) =>
      this.animate(timestamp)
    );
  }

  public stop() {
    Logger.info("Idetik", "Idetik runtime stopped");
    if (this.lastAnimationId_ !== undefined) {
      Logger.info(
        "Idetik",
        "Cancelling animation frame",
        this.lastAnimationId_
      );
      cancelAnimationFrame(this.lastAnimationId_);
      this.lastAnimationId_ = undefined;
    }
  }
}
