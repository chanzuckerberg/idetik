import { Renderer } from "core/renderer";
import { RenderableObject } from "core/renderable_object";
import { WebGLShaderProgram } from "./webgl_shader_program";

import { Shader, shaderCode } from "./shaders";
import { WebGLBuffers } from "./webgl_buffers";
import { WebGLTextures } from "./webgl_textures";
import { ProjectedLine } from "objects/renderable/projected_line";

import { mat4 } from "gl-matrix";
import { DataTexture2D } from "objects/textures/data_texture_2d";
import { Texture2DArray } from "objects/textures/texture_2d_array";

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

    switch (object.type) {
      case "ProjectedLine": {
        program.setUniform("Resolution", [
          this.canvas.width,
          this.canvas.height,
        ]);
        const line = object as ProjectedLine;
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

      // This should probably be moved to the switch case above on the
      // renderable object type, but is a little awkward there because a
      // Mesh may not have a texture. Similarly, the channel info used here
      // may be better stored in a renderable object than a texture.
      // Both these facts may motivate defining an Image renderable object
      // that has exactly one texture.
      switch (texture.type) {
        case "DataTexture2D": {
          const dataTexture = texture as DataTexture2D;
          const contrastLimits = dataTexture.channel.contrastLimits;
          const valueOffset = -contrastLimits[0];
          const valueScale = 1 / (contrastLimits[1] - contrastLimits[0]);
          program.setUniform("Color", dataTexture.channel.color);
          program.setUniform("ValueOffset", valueOffset);
          program.setUniform("ValueScale", valueScale);
          break;
        }
        case "Texture2DArray": {
          const texture2DArray = texture as Texture2DArray;
          const visible = new Array<boolean>();
          const color = new Array<number>();
          const valueOffset = new Array<number>();
          const valueScale = new Array<number>();

          // Fill arrays up to MAX_CHANNELS
          const MAX_CHANNELS = 16;
          for (let i = 0; i < MAX_CHANNELS; i++) {
            if (i < texture2DArray.channels.length) {
              const channel = texture2DArray.channels[i];
              const contrastLimits = channel.contrastLimits;
              visible.push(channel.visible);
              color.push(...channel.color);
              valueOffset.push(-contrastLimits[0]);
              valueScale.push(1 / (contrastLimits[1] - contrastLimits[0]));
            } else {
              // Pad remaining slots with default values
              visible.push(false);
              color.push(0, 0, 0);
              valueOffset.push(0);
              valueScale.push(1);
            }
          }
          // TODO: we should be careful of uninitialized values here, though it appears they
          // are zero-initialized in the shaders.

          program.setUniform("Visible[0]", visible);
          program.setUniform("Color[0]", color);
          program.setUniform("ValueOffset[0]", valueOffset);
          program.setUniform("ValueScale[0]", valueScale);
          break;
        }
      }
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
