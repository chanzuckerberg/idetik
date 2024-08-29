import { Renderer } from "core/renderer";
import { Mesh } from "objects/renderable/mesh";
import { WebGLShaderProgram } from "./webgl_shader_program";

import { Shader, shaderCode } from "./shaders";

export class WebGLRenderer extends Renderer {
  private readonly gl_: WebGL2RenderingContext | null = null;
  private readonly shaders_: Map<Shader, WebGLShaderProgram>;

  constructor(selector: string) {
    super(selector);

    this.gl_ = this.canvas.getContext("webgl2");
    if (!this.gl_) {
      throw new Error(`Failed to initialize WebGL2 context`);
    }
    console.log(`WebGL version ${this.gl.getParameter(this.gl.VERSION)}`);
    this.shaders_ = new Map<Shader, WebGLShaderProgram>();
    this.gl.viewport(0, 0, this.width, this.height);
  }

  protected renderMesh(_: Mesh) {
    const program = this.getShaderProgram("mesh").use();
    program.setUniform("Projection", this.activeCamera.projectionTransform);
    // TODO: instantiate webgl_mesh_storage (if needed)
    // TODO: render mesh
  }

  protected resize(width: number, height: number) {
    this.gl.viewport(0, 0, width, height);
  }

  protected clear() {
    this.gl.clearColor(0.12, 0.13, 0.25, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  private getShaderProgram(type: Shader) {
    if (!this.shaders_.has(type)) {
      this.shaders_.set(
        type,
        new WebGLShaderProgram(
          this.gl,
          shaderCode[type].vertex,
          shaderCode[type].fragment
        )
      );
    }
    return this.shaders_.get(type)!;
  }

  private get gl() {
    return this.gl_!;
  }
}
