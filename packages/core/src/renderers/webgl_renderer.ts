import { Renderer } from "../core/renderer";
import { WebGLShaderProgram } from "./webgl_shader_program";
import { WebGLShaderPrograms } from "./webgl_shader_programs";
import { Logger } from "../utilities/logger";

import { WebGLBuffers } from "./webgl_buffers";
import { WebGLTextures } from "./webgl_textures";

import { Layer } from "../core/layer";
import { LayerManager } from "../core/layer_manager";
import { Camera } from "../objects/cameras/camera";
import { WebGLState } from "./WebGLState";
import { RenderableObject } from "../core/renderable_object";
import { Geometry, Primitive } from "../core/geometry";
import { Box2 } from "../math/box2";

import { mat4, vec2 } from "gl-matrix";

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
  private readonly programs_: WebGLShaderPrograms;
  private readonly bindings_: WebGLBuffers;
  private readonly textures_: WebGLTextures;
  private readonly state_: WebGLState;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);

    this.gl_ = this.canvas.getContext("webgl2", {
      depth: true,
      antialias: false,
    });
    if (!this.gl_) {
      throw new Error(`Failed to initialize WebGL2 context`);
    }
    Logger.info(
      "WebGLRenderer",
      `WebGL version ${this.gl.getParameter(this.gl.VERSION)}`
    );

    this.programs_ = new WebGLShaderPrograms(this.gl);
    this.bindings_ = new WebGLBuffers(this.gl);
    this.textures_ = new WebGLTextures(this.gl);
    this.resize(this.canvas.width, this.canvas.height);
    this.state_ = new WebGLState(this.gl);
  }

  public render(
    layerManager: LayerManager,
    camera: Camera,
    viewportBox?: Box2
  ) {
    if (viewportBox) {
      this.state_.setViewport(viewportBox);
      this.state_.enableScissor();
    } else {
      this.state_.disableScissor();
      const defaultViewport = new Box2(
        vec2.fromValues(0, 0),
        vec2.fromValues(this.canvas.width, this.canvas.height)
      );
      this.state_.setViewport(defaultViewport);
    }

    this.clear();
    this.activeCamera = camera;

    const { opaque, transparent } = layerManager.partitionLayers();

    this.state_.setDepthMask(true);
    for (const layer of opaque) {
      layer.update();
      if (layer.state === "ready") {
        this.renderLayer(layer);
      }
    }

    this.state_.setDepthMask(false);
    for (const layer of transparent) {
      layer.update();
      if (layer.state !== "ready") continue;
      this.renderLayer(layer);
    }
    this.state_.setDepthMask(true);
  }

  public get textureInfo() {
    return this.textures_.textureInfo;
  }

  private renderLayer(layer: Layer) {
    this.state_.setBlendingMode(layer.transparent ? layer.blendMode : "none");
    layer.objects.forEach((_, i) => this.renderObject(layer, i));
  }

  protected renderObject(layer: Layer, objectIndex: number) {
    const object = layer.objects[objectIndex];
    this.bindings_.bindGeometry(object.geometry);
    object.popStaleTextures().forEach((texture) => {
      this.textures_.disposeTexture(texture);
    });
    object.textures.forEach((texture, index) => {
      this.textures_.bindTexture(texture, index);
    });

    const program = this.programs_.use(object.programName);
    this.drawGeometry(object.geometry, object, layer, program);

    if (object.wireframeEnabled) {
      this.bindings_.bindGeometry(object.wireframeGeometry);
      const wireframeProgram = this.programs_.use("wireframe");
      wireframeProgram.setUniform("u_color", object.wireframeColor.rgb);
      this.drawGeometry(
        object.wireframeGeometry,
        object,
        layer,
        wireframeProgram
      );
    }
  }

  private drawGeometry(
    geometry: Geometry,
    object: RenderableObject,
    layer: Layer,
    program: WebGLShaderProgram
  ) {
    const modelView = mat4.multiply(
      mat4.create(),
      this.activeCamera.viewMatrix,
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
          if (uniformName in objectUniforms) {
            program.setUniform(uniformName, objectUniforms[uniformName]);
          }
      }
    }

    const primitive = this.glGetPrimitive(geometry.primitive);
    const index = geometry.indexData;
    if (index.length) {
      this.gl.drawElements(primitive, index.length, this.gl.UNSIGNED_INT, 0);
    } else {
      this.gl.drawArrays(primitive, 0, geometry.vertexCount);
    }
  }

  private glGetPrimitive(type: Primitive) {
    switch (type) {
      case "points":
        return this.gl.POINTS;
      case "triangles":
        return this.gl.TRIANGLES;
      case "lines":
        return this.gl.LINES;
      default: {
        const exhaustiveCheck: never = type;
        throw new Error(`Unknown Primitive type: ${exhaustiveCheck}`);
      }
    }
  }

  protected resize(width: number, height: number) {
    const defaultViewport = new Box2(
      vec2.fromValues(0, 0),
      vec2.fromValues(width, height)
    );
    this.state_.setViewport(defaultViewport);
  }

  protected clear() {
    this.gl.clearColor(...this.backgroundColor.rgba);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    this.state_.setDepthTesting(true);
    this.gl.depthFunc(this.gl.LEQUAL);
  }

  private get gl() {
    return this.gl_!;
  }
}
