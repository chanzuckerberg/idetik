import { Renderer } from "../core/renderer";
import { Mesh } from "../objects/renderable/mesh";
import { WebGLShaderProgram } from "./webgl_shader_program";

import { Shader, shaderCode } from "./shaders";
import { WebGLBindings } from "./webgl_bindings";
import { WebGLTextures } from "./webgl_textures";

export class WebGLRenderer extends Renderer {
  private readonly gl_: WebGL2RenderingContext | null = null;
  private readonly shaders_: Map<Shader, WebGLShaderProgram>;
  private readonly bindings_: WebGLBindings;
  private readonly textures_: WebGLTextures;

  constructor(selector: string) {
    super(selector);

    this.gl_ = this.canvas.getContext("webgl2");
    if (!this.gl_) {
      throw new Error(`Failed to initialize WebGL2 context`);
    }
    console.log(`WebGL version ${this.gl.getParameter(this.gl.VERSION)}`);
    this.shaders_ = new Map<Shader, WebGLShaderProgram>();
    this.bindings_ = new WebGLBindings(this.gl);
    this.textures_ = new WebGLTextures(this.gl);
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
  }

  protected renderMesh(mesh: Mesh) {
    const programName =
      mesh.texture?.type === "Uint16Texture2D" ? "uint16Image" : "mesh";
    const program = this.getShaderProgram(programName).use();
    program.setUniformMat4("Projection", this.activeCamera.projectionTransform);
    program.setUniformMat4("ModelView", this.activeCamera.viewTransform);

    this.bindings_.bind(mesh);
    if (mesh.texture !== null) {
      this.textures_.bind(mesh.texture);
    }

    const type = this.gl.TRIANGLES;
    if (mesh.index) {
      this.gl.drawElements(type, mesh.index.length, this.gl.UNSIGNED_INT, 0);
    } else {
      this.gl.drawArrays(type, 0, mesh.source.itemsSize);
    }
  }

  protected resize(width: number, height: number) {
    this.gl.viewport(0, 0, width, height);
  }

  protected clear() {
    this.gl.clearColor(0, 0, 0, 1.0);
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
