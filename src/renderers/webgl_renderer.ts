import { Renderer } from "core/renderer";
import { RenderableObject } from "core/renderable_object";
import { WebGLShaderProgram } from "./webgl_shader_program";

import { Shader, shaderCode } from "./shaders";
import { WebGLBuffers } from "./webgl_buffers";
import { WebGLTextures } from "./webgl_textures";
import { ProjectedLine } from "objects/renderable/projected_line";

import { mat4 } from "gl-matrix";


// The library's coordinate system is left-handed.
// With the default camera, the standard basis vectors should
// look as follows.
// (1, 0, 0) points to the right of the screen
// (0, 1, 0) points to the bottom of the screen
// (0, 0, 1) points out of the screen
// WebGL's coordinate system is right-handed where the vectors
// point in the same directions except that
// (0, 1, 0) points to the top of the screen
// Therefore, this transform makes the appropriate flip in y.
const axisDirection = mat4.fromScaling(mat4.create(), [1, -1, 1]);

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
    this.resize(this.canvas.width, this.canvas.height);
  }

  protected renderObject(object: RenderableObject) {
    const program = this.getShaderProgram(object.programName).use();

    // Set common uniforms
    const modelView = mat4.multiply(
      mat4.create(),
      this.activeCamera.transform.inverse,
      object.transform.matrix
    );
    program.setUniform("ModelView", modelView);
    const projection = mat4.multiply(
      mat4.create(),
      axisDirection,
      this.activeCamera.projectionMatrix
    );
    program.setUniform("Projection", projection);

    // Handle special cases that need renderer info
    switch (object.type) {
      case "ProjectedLine": {
        const line = object as ProjectedLine;
        program.setUniform("Resolution", [this.canvas.width, this.canvas.height]);
        program.setUniform("LineColor", line.color);
        program.setUniform("LineWidth", line.width);
        program.setUniform("TaperOffset", line.taperOffset);
        program.setUniform("TaperPower", line.taperPower);
        break;
      }
    }

    this.bindings_.bind(object);

    if (object.textures.length) {
      // We temporarily assume this array holds a single texture. We'll need to
      // modify this logic to support multiple textures in the future.
      const texture = object.textures[0];
      this.textures_.bind(texture);
    }

    // Get uniforms from the renderable object
    const uniforms = object.getUniforms();
    for (const [name, value] of Object.entries(uniforms)) {
      program.setUniform(name, value);
    }

    // Draw the object
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
    this.gl.clearColor(...this.backgroundColor);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.depthFunc(this.gl.LEQUAL);
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
