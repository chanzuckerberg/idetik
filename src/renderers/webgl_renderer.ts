import { mat4 } from "gl-matrix";

import { Renderer } from "core/renderer";
import { Mesh } from "objects/renderable/mesh";
import { Line } from "objects/renderable/line";
import { WebGLShaderProgram } from "./webgl_shader_program";

import { Shader, shaderCode } from "./shaders";
import { WebGLBindings } from "./webgl_bindings";

export class WebGLRenderer extends Renderer {
  private readonly gl_: WebGL2RenderingContext | null = null;
  private readonly shaders_: Map<Shader, WebGLShaderProgram>;
  private readonly bindings_: WebGLBindings;

  constructor(selector: string) {
    super(selector);

    this.gl_ = this.canvas.getContext("webgl2", {depth: true});
    if (!this.gl_) {
      throw new Error(`Failed to initialize WebGL2 context`);
    }
    console.log(`WebGL version ${this.gl.getParameter(this.gl.VERSION)}`);
    this.shaders_ = new Map<Shader, WebGLShaderProgram>();
    this.bindings_ = new WebGLBindings(this.gl);
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
  }

  protected renderMesh(mesh: Mesh) {
    const program = this.getShaderProgram("mesh").use();
    program.setUniformMat4("Projection", this.activeCamera.projectionTransform);
    program.setUniformMat4("ModelView", this.activeCamera.viewTransform);
    program.setUniformVec2("Resolution", [this.width, this.height]);
    program.setUniformFloat("Time", performance.now() / 1000);

    this.bindings_.bind(mesh);
    const type = this.gl.TRIANGLES;
    if (mesh.index) {
      this.gl.drawElements(type, mesh.index.length, this.gl.UNSIGNED_INT, 0);
    } else {
      this.gl.drawArrays(type, 0, mesh.source.itemsSize);
    }
  }

  protected renderLine(line: Line) {
    const program = this.getShaderProgram("line").use();
    const view = this.activeCamera.viewTransform;

    // TODO: this is just a placeholder animation
    const model = mat4.create();
    const angle = (performance.now() / 10000) * Math.PI;
    mat4.translate(model, model, [0, 0, -5]);
    mat4.rotateY(model, model, angle);
    mat4.translate(model, model, [0, 0, 5]);
    const modelView = mat4.create();
    mat4.multiply(modelView, view, model);

    program.setUniformMat4("Projection", this.activeCamera.projectionTransform);
    program.setUniformMat4("ModelView", modelView);
    program.setUniformVec2("Resolution", [this.width, this.height]);
    program.setUniformFloat("LineWidth", line.width);
    program.setUniformVec3("LineColor", line.color);

    this.bindings_.bind(line);
    const type = this.gl.TRIANGLES;
    this.gl.drawElements(
      type,
      line.geometry.index.length,
      this.gl.UNSIGNED_INT,
      0
    );
  }

  protected resize(width: number, height: number) {
    this.gl.viewport(0, 0, width, height);
  }

  protected clear() {
    this.gl.clearColor(0.12, 0.13, 0.25, 1.0);
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
