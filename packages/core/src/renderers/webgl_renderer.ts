import { Renderer } from "core/renderer";
import { WebGLShaderProgram } from "./webgl_shader_program";
import { Logger } from "utilities/logger";

import { Shader, shaderCode } from "./shaders";
import { WebGLBuffers } from "./webgl_buffers";
import { WebGLTextures } from "./webgl_textures";

import { mat4 } from "gl-matrix";
import { Layer } from "../core/layer";
import { LayerManager } from "../core/layer_manager";
import { Camera } from "../objects/cameras/camera";
import { WebGLState } from "./WebGLState";

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
  private readonly webglState_: WebGLState;

  constructor(selector: string) {
    super(selector);

    this.gl_ = this.canvas.getContext("webgl2", { depth: true });
    if (!this.gl_) {
      throw new Error(`Failed to initialize WebGL2 context`);
    }
    Logger.info(
      "WebGLRenderer",
      `WebGL version ${this.gl.getParameter(this.gl.VERSION)}`
    );

    this.shaders_ = new Map<Shader, WebGLShaderProgram>();
    this.bindings_ = new WebGLBuffers(this.gl);
    this.textures_ = new WebGLTextures(this.gl);
    this.resize(this.canvas.width, this.canvas.height);
    this.webglState_ = new WebGLState(this.gl);
  }

  private renderLayer(layer: Layer) {
    layer.objects.forEach((_, i) => this.renderObject(layer, i));
  }

  public render(layerManager: LayerManager, camera: Camera) {
    this.clear();
    this.syncActiveCamera(camera);

    const { opaque, transparent } = layerManager.partitionLayers();

    this.webglState_.disable(this.gl.BLEND);
    this.webglState_.setDepthMask(true);
    for (const layer of opaque) {
      layer.update();
      if (layer.state === "ready") {
        this.renderLayer(layer);
      }
    }

    this.webglState_.enable(this.gl.BLEND);
    this.webglState_.setDepthMask(false);
    for (const layer of transparent) {
      layer.update();
      if (layer.state !== "ready") continue;
      this.renderLayer(layer);
    }
    this.webglState_.setDepthMask(true);
  }

  protected renderObject(layer: Layer, objectIndex: number) {
    const object = layer.objects[objectIndex];
    const program = this.getShaderProgram(object.programName).use();

    if (layer.transparent) {
      switch (layer.blendMode) {
        case "additive":
          this.webglState_.setBlendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
          break;
        case "multiply":
          this.webglState_.setBlendFunc(this.gl.DST_COLOR, this.gl.ZERO);
          break;
        case "subtractive":
          this.webglState_.setBlendFunc(
            this.gl.ZERO,
            this.gl.ONE_MINUS_SRC_COLOR
          );
          break;
        case "normal":
        default:
          this.webglState_.setBlendFunc(
            this.gl.SRC_ALPHA,
            this.gl.ONE_MINUS_SRC_ALPHA
          );
      }
    }
    const modelView = mat4.multiply(
      mat4.create(),
      this.activeCamera.transform.inverse,
      object.transform.matrix
    );
    const projection = mat4.multiply(
      mat4.create(),
      axisDirection,
      this.activeCamera.projectionMatrix
    );
    const resolution = [this.canvas.width, this.canvas.height];

    const objectUniforms = object.getUniforms();
    for (const uniformName of program.uniformNames) {
      switch (uniformName) {
        // Set common uniforms with renderer data
        case "ModelView":
          program.setUniform(uniformName, modelView);
          break;
        case "Projection":
          program.setUniform(uniformName, projection);
          break;
        case "Resolution":
          program.setUniform(uniformName, resolution);
          break;
        case "u_opacity":
          program.setUniform(uniformName, layer.opacity);
          break;
        default:
          // Get uniforms from the renderable object
          if (uniformName in objectUniforms) {
            program.setUniform(uniformName, objectUniforms[uniformName]);
          }
      }
    }

    this.bindings_.bind(object);

    object.textures.forEach((texture) => {
      this.textures_.bind(texture);
    });

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
