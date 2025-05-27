import { Camera } from "./objects/cameras/camera";
import { Layer } from "./core/layer";
import { LayerManager } from "./core/layer_manager";
import { WebGLRenderer } from "./renderers/webgl_renderer";
import { PanZoomControls } from "./objects/cameras/controls";
import { Logger } from "./utilities/logger";

type IdetikParams = {
  canvasSelector: string;
  camera?: Camera;
  controls?: PanZoomControls;
  layers?: Layer[];
};

export class Idetik {
  public layerManager: LayerManager;
  public camera?: Camera;

  private readonly renderer_: WebGLRenderer;

  constructor(params: IdetikParams) {
    this.camera = params.camera || undefined;
    this.layerManager = new LayerManager();
    this.renderer_ = new WebGLRenderer(params.canvasSelector);

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
      this.renderer_.render(this.layerManager, this.camera);
      requestAnimationFrame(render);
    };
    render();
    return this;
  }
}
