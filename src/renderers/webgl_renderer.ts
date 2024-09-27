import { Renderer } from "core/renderer";
import { RenderableObject } from "core/renderable_object";
import { WebGLShaderProgram } from "./webgl_shader_program";

import { Shader, shaderCode } from "./shaders";
import { WebGLBuffers } from "./webgl_buffers";
import { WebGLTextures } from "./webgl_textures";
import { ProjectedLine } from "objects/renderable/projected_line";

export class WebGLRenderer extends Renderer {
  private readonly gl_: WebGL2RenderingContext | null = null;
  private readonly shaders_: Map<Shader, WebGLShaderProgram>;
  private readonly bindings_: WebGLBuffers;
  private readonly textures_: WebGLTextures;

  constructor(selector: string) {
    super(selector);

    this.gl_ = this.canvas.getContext("webgl2", { depth: true });
    if (!this.gl_) {
      throw new Error(`Failed to initialize WebGL2 context`);
    }
    console.log(`WebGL version ${this.gl.getParameter(this.gl.VERSION)}`);

    this.shaders_ = new Map<Shader, WebGLShaderProgram>();
    this.bindings_ = new WebGLBuffers(this.gl);
    this.textures_ = new WebGLTextures(this.gl);
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
  }

  protected renderObject(object: RenderableObject) {
    const program = this.getShaderProgram(this.getProgramName(object)).use();

    program.setUniform("Projection", this.activeCamera.projectionTransform);
    program.setUniform("ModelView", this.activeCamera.viewTransform);

    switch (object.type) {
      case "ProjectedLine": {
        program.setUniform("Resolution", [
          this.canvas.width,
          this.canvas.height,
        ]);
        const line = object as ProjectedLine;
        program.setUniform("LineColor", line.color);
        program.setUniform("LineWidth", line.width);
        break;
      }
    }

    this.bindings_.bind(object);

    if (object.textures.length) {
      // We temporarily assume this array holds a single texture. We'll need to
      // modify this logic to support multiple textures in the future.
      this.textures_.bind(object.textures[0]);
    }

    // TODO: Move 'type' property to RenderableObject
    const type = this.gl.TRIANGLES;
    const index = object.geometry.indexData;
    if (index.length) {
      this.gl.drawElements(type, index.length, this.gl.UNSIGNED_INT, 0);
    } else {
      this.gl.drawArrays(type, 0, object.geometry.itemSize);
    }
  }

  protected resize(width: number, height: number) {
    this.gl.viewport(0, 0, width, height);
  }

  protected clear() {
    this.gl.clearColor(0, 0, 0, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    this.gl.enable(this.gl.DEPTH_TEST);
  }

  // This is a temporary computed property. In the future, we want to assign the
  // program name to the class derived from the renderable object but we need to
  // refactor textures first (consolidating the two programs below.)
  private getProgramName(object: RenderableObject) {
    if (object.type === "ProjectedLine") return "projectedLine";
    return object.textures.length &&
      object.textures[0].type === "Uint16Texture2D"
      ? "uint16Image"
      : "mesh";
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
