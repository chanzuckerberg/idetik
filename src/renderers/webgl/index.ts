import { LayerManager } from "core/layer_manager";
import { Renderer } from "core/renderer";

export class WebGLRenderer extends Renderer {
  private readonly gl_: WebGL2RenderingContext | null = null;

  constructor(selector: string, layers: LayerManager) {
    super(selector, layers);

    this.gl_ = this.canvas.getContext("webgl2");
    if (!this.gl_) {
      throw new Error(`Failed to initialize WebGL2 context`);
    }
    console.log(`WebGL version ${this.gl.getParameter(this.gl.VERSION)}`);
    this.gl.viewport(0, 0, this.width, this.height);
  }

  protected resize(width: number, height: number) {
    this.gl.viewport(0, 0, width, height);
  }

  protected renderFrame(_: number) {
    this.gl.clearColor(0.12, 0.13, 0.25, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // TODO: add rendering code
  }

  private get gl() {
    return this.gl_!;
  }
}
