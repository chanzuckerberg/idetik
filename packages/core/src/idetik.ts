import { Camera } from "./objects/cameras/camera";
import { Layer } from "./core/layer";
import { LayerManager } from "./core/layer_manager";
import { WebGLRenderer } from "./renderers/webgl_renderer";
import { PanZoomControls } from "./objects/cameras/controls";
import { Logger } from "./utilities/logger";
import { ChunkManager } from "./core/chunk_manager";

type IdetikParams = {
  canvasSelector: string;
  camera: Camera;
  controls?: PanZoomControls;
  layers?: Layer[];
};

export type IdetikContext = {
  chunkManager: ChunkManager;
};

export class Idetik {
  public layerManager: LayerManager;
  public camera: Camera;

  private readonly context_: IdetikContext;
  private readonly renderer_: WebGLRenderer;
  private readonly chunkManager_: ChunkManager;

  constructor(params: IdetikParams) {
    this.camera = params.camera;
    this.renderer_ = new WebGLRenderer(params.canvasSelector);
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
  }

  public get width() {
    return this.renderer_.width;
  }

  public get height() {
    return this.renderer_.height;
  }

  // TODO: this should be modified once the controls are moved to the idetik class
  public setControls(controls: PanZoomControls) {
    this.renderer_.setControls(controls);
  }

  public start() {
    Logger.info("Idetik", "Idetik runtime started");
    const render = () => {
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
      this.renderer_.render(this.layerManager, this.camera);
      requestAnimationFrame(render);
    };
    render();
    return this;
  }
}
