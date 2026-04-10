import { Renderer } from "../core/renderer";
import { WebGLShaderProgram } from "./webgl_shader_program";
import { WebGLShaderPrograms } from "./webgl_shader_programs";
import { Logger } from "../utilities/logger";

import { WebGLBuffers } from "./webgl_buffers";
import { WebGLTextures } from "./webgl_textures";

import { Layer } from "../core/layer";
import { WebGLState } from "./webgl_state";
import { RenderableObject } from "../core/renderable_object";
import { Geometry, Primitive } from "../core/geometry";
import { Box2 } from "../math/box2";
import { Viewport } from "../core/viewport";
import { Camera } from "../objects/cameras/camera";

import { mat4, vec2, vec3, vec4 } from "gl-matrix";
import { Frustum } from "../math/frustum";

// Idetik defines screen-space with +Y pointing downward.
// With the default camera, the basis vectors are:
// (1, 0, 0) → right
// (0, 1, 0) → down
// (0, 0, 1) → out of the screen
//
// To match this convention, we flip Y in the projection matrix.
// This is a mirror transform, which also flips triangle winding.
const axisDirection = mat4.fromScaling(mat4.create(), [1, -1, 1]);

export class WebGLRenderer extends Renderer {
  private readonly gl_: WebGL2RenderingContext;
  private readonly programs_: WebGLShaderPrograms;
  private readonly bindings_: WebGLBuffers;
  private readonly textures_: WebGLTextures;
  private readonly state_: WebGLState;
  private renderedObjectsPerFrame_ = 0;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);

    const gl = this.canvas.getContext("webgl2", {
      depth: true,
      antialias: true,
      stencil: true,
    });
    if (!gl) {
      throw new Error(`Failed to initialize WebGL2 context`);
    }
    this.gl_ = gl;
    Logger.info(
      "WebGLRenderer",
      `WebGL version ${gl.getParameter(gl.VERSION)}`
    );

    this.programs_ = new WebGLShaderPrograms(gl);
    this.bindings_ = new WebGLBuffers(gl);
    this.textures_ = new WebGLTextures(gl);
    this.state_ = new WebGLState(gl);
    this.initStencil();
    this.resize(this.canvas.width, this.canvas.height);
  }

  public render(viewport: Viewport) {
    let viewportIsVisible =
      getComputedStyle(viewport.element).visibility !== "hidden";
    const viewportBox = viewport.getBoxRelativeTo(this.canvas);
    const rendererBox = new Box2(
      vec2.fromValues(0, 0),
      vec2.fromValues(this.width, this.height)
    );
    if (Box2.equals(viewportBox.floor(), rendererBox.floor())) {
      this.state_.setScissorTest(false);
    } else if (Box2.intersects(viewportBox, rendererBox)) {
      this.state_.setScissor(viewportBox);
      this.state_.setScissorTest(true);
    } else {
      Logger.warn(
        "WebGLRenderer",
        `Viewport ${viewport.id} is entirely outside canvas bounds, skipping render`
      );
      viewportIsVisible = false;
    }
    this.state_.setViewport(viewportBox);
    this.renderedObjectsPerFrame_ = 0;
    if (viewportIsVisible) {
      this.clear();
    }

    const { opaque, transparent } = viewport.layerManager.partitionLayers();

    this.state_.setDepthMask(true);

    const frustum = viewport.camera.frustum;
    const renderContext = { viewport };

    for (const layer of opaque) {
      layer.update(renderContext);
      if (layer.state === "ready" && viewportIsVisible) {
        this.renderLayer(layer, viewport.camera, frustum);
      }
    }

    this.state_.setDepthMask(false);
    for (const layer of transparent) {
      layer.update(renderContext);
      if (layer.state === "ready" && viewportIsVisible) {
        this.renderLayer(layer, viewport.camera, frustum);
      }
    }
    this.state_.setDepthMask(true);

    this.renderedObjects_ = this.renderedObjectsPerFrame_;
  }

  public get textureInfo() {
    return this.textures_.textureInfo;
  }

  private initStencil() {
    // We use the stencil buffer to mark pixels objects have been drawn,
    // which is used to avoid overdrawing high resolution tiles with lower
    // resolution ones.
    const clearValue = 0;
    this.gl_.clearStencil(clearValue);
    this.gl_.stencilMask(0xff);
    this.gl_.stencilFunc(this.gl_.EQUAL, clearValue, 0xff);
    this.gl_.stencilOp(this.gl_.KEEP, this.gl_.KEEP, this.gl_.INCR);
  }

  private renderLayer(layer: Layer, camera: Camera, frustum: Frustum) {
    if (layer.objects.length === 0) return;
    this.state_.setBlendingMode(layer.transparent ? layer.blendMode : "none");
    const shouldUseStencil = layer.hasMultipleLODs();
    this.state_.setStencilTest(shouldUseStencil);
    if (shouldUseStencil) {
      this.gl_.clear(this.gl_.STENCIL_BUFFER_BIT);
    }

    layer.objects.forEach((object, i) => {
      if (frustum.intersectsWithBox3(object.boundingBox)) {
        this.renderObject(layer, i, camera);
        this.renderedObjectsPerFrame_ += 1;
      }
    });
  }

  protected renderObject(layer: Layer, objectIndex: number, camera: Camera) {
    const object = layer.objects[objectIndex];
    object.popStaleTextures().forEach((texture) => {
      this.textures_.disposeTexture(texture);
    });

    if (!object.programName) return;
    this.state_.setCullFaceMode(object.cullFaceMode);
    this.state_.setDepthTesting(object.depthTest);
    this.state_.setDepthMask(object.depthTest);
    this.bindings_.bindGeometry(object.geometry);
    object.textures.forEach((texture, index) => {
      this.textures_.bindTexture(texture, index);
    });

    const program = this.programs_.use(object.programName);
    this.drawGeometry(object.geometry, object, layer, program, camera);

    if (object.wireframeEnabled) {
      this.bindings_.bindGeometry(object.wireframeGeometry);
      const wireframeProgram = this.programs_.use("wireframe");
      wireframeProgram.setUniform("u_color", object.wireframeColor.rgb);
      this.drawGeometry(
        object.wireframeGeometry,
        object,
        layer,
        wireframeProgram,
        camera
      );
    }
  }

  private drawGeometry(
    geometry: Geometry,
    object: RenderableObject,
    layer: Layer,
    program: WebGLShaderProgram,
    camera: Camera
  ) {
    const modelView = mat4.multiply(
      mat4.create(),
      camera.viewMatrix,
      object.transform.matrix
    );
    const projection = mat4.multiply(
      mat4.create(),
      axisDirection,
      camera.projectionMatrix
    );
    const resolution = [this.canvas.width, this.canvas.height];

    const objectUniforms = object.getUniforms();
    const layerUniforms = layer.getUniforms();
    const allUniforms = {
      ...layerUniforms,
      ...objectUniforms,
    };

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
        case "CameraPositionModel": {
          const inverseModelView = mat4.invert(mat4.create(), modelView)!;
          const cameraPositionView = vec4.fromValues(0, 0, 0, 1);
          const cameraPositionModel = vec4.transformMat4(
            vec4.create(),
            cameraPositionView,
            inverseModelView
          );
          program.setUniform(
            uniformName,
            vec3.fromValues(
              cameraPositionModel[0],
              cameraPositionModel[1],
              cameraPositionModel[2]
            )
          );
          break;
        }
        default:
          if (uniformName in allUniforms) {
            program.setUniform(uniformName, allUniforms[uniformName]);
          }
      }
    }

    const primitive = this.glGetPrimitive(geometry.primitive);
    const index = geometry.indexData;
    if (index.length) {
      this.gl_.drawElements(primitive, index.length, this.gl_.UNSIGNED_INT, 0);
    } else {
      this.gl_.drawArrays(primitive, 0, geometry.vertexCount);
    }
  }

  private glGetPrimitive(type: Primitive) {
    switch (type) {
      case "points":
        return this.gl_.POINTS;
      case "triangles":
        return this.gl_.TRIANGLES;
      case "lines":
        return this.gl_.LINES;
      default: {
        const exhaustiveCheck: never = type;
        throw new Error(`Unknown Primitive type: ${exhaustiveCheck}`);
      }
    }
  }

  protected resize(width: number, height: number) {
    const newViewport = new Box2(
      vec2.fromValues(0, 0),
      vec2.fromValues(width, height)
    );
    this.state_.setViewport(newViewport);
  }

  protected clear() {
    this.gl_.clearColor(...this.backgroundColor.rgba);
    this.gl_.clear(this.gl_.COLOR_BUFFER_BIT | this.gl_.DEPTH_BUFFER_BIT);
    this.state_.setDepthTesting(true);
    this.gl_.depthFunc(this.gl_.LEQUAL);
  }
}
