import { Renderer } from "core/renderer";
import { RenderableObject } from "core/renderable_object";
import { Mesh } from "objects/renderable/mesh";
import { WebGLShaderProgram } from "./webgl_shader_program";

import { Shader, shaderCode } from "./shaders";
import { WebGLBindings } from "./webgl_bindings";
import { WebGLTextures } from "./webgl_textures";

const DEFAULT_PROGRAM: Shader = "mesh";
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

  protected renderObject(object: RenderableObject) {
    const program = this.getShaderProgram(this.getProgramName(object)).use();
    program.setUniformMat4("Projection", this.activeCamera.projectionTransform);
    program.setUniformMat4("ModelView", this.activeCamera.viewTransform);

    this.bindings_.bind(object);

    if (object.type === "Mesh") {
      const mesh = object as Mesh;
      if (mesh.texture !== null) {
        this.textures_.bind(mesh.texture);
      }
    }

    const type = this.gl.TRIANGLES;
    const index = object.geometry.indexData;
    if (index) {
      this.gl.drawElements(type, index.length, this.gl.UNSIGNED_INT, 0);
    } else {
      this.gl.drawArrays(type, 0, object.geometry.itemSize);
    }
  }

  protected resize(width: number, height: number) {
    this.gl.viewport(0, 0, width, height);
  }

  protected clear() {
    this.gl.clearColor(0.12, 0.13, 0.25, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  private getProgramName(object: RenderableObject) {
    if (object.type === "Mesh") {
      const mesh = object as Mesh;
      return mesh.texture?.type === "Uint16Texture2D" ? "uint16Image" : "mesh";
    }
    return DEFAULT_PROGRAM;
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
