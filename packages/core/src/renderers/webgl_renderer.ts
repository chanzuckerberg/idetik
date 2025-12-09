import { Renderer } from "../core/renderer";
import { WebGLShaderProgram } from "./webgl_shader_program";
import { WebGLShaderPrograms } from "./webgl_shader_programs";
import { Logger } from "../utilities/logger";

import { WebGLBuffers } from "./webgl_buffers";
import { WebGLTextures } from "./webgl_textures";

import { Layer } from "../core/layer";
import { WebGLState } from "./WebGLState";
import { RenderableObject } from "../core/renderable_object";
import { Geometry, Primitive } from "../core/geometry";
import { Box2 } from "../math/box2";
import { Viewport } from "../core/viewport";
import { Camera } from "../objects/cameras/camera";

import { mat4, vec2 } from "gl-matrix";
import { Frustum } from "../math/frustum";

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

const stencilClearValue = 0;

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
    if (gl === null) {
      throw new Error(`Failed to initialize WebGL2 context`);
    }
    this.gl_ = gl;
    Logger.info(
      "WebGLRenderer",
      `WebGL version ${this.gl.getParameter(this.gl.VERSION)}`
    );

    this.programs_ = new WebGLShaderPrograms(this.gl);
    this.bindings_ = new WebGLBuffers(this.gl);
    this.textures_ = new WebGLTextures(this.gl);
    this.state_ = new WebGLState(this.gl);
    this.initStencil();
    this.resize(this.canvas.width, this.canvas.height);
  }

  public render(viewport: Viewport) {
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
      return;
    }
    this.state_.setViewport(viewportBox);
    this.renderedObjectsPerFrame_ = 0;
    this.clear();

    const { opaque, transparent } = viewport.layerManager.partitionLayers();

    this.state_.setDepthMask(true);

    const frustum = viewport.camera.frustum;
    const renderContext = { viewport };

    for (const layer of opaque) {
      layer.update(renderContext);
      if (layer.state === "ready") {
        this.renderLayer(layer, viewport.camera, frustum);
      }
    }

    this.state_.setDepthMask(false);
    for (const layer of transparent) {
      layer.update(renderContext);
      if (layer.state !== "ready") continue;
      this.renderLayer(layer, viewport.camera, frustum);
    }
    this.state_.setDepthMask(true);

    this.renderedObjects_ = this.renderedObjectsPerFrame_;
  }

  public get textureInfo() {
    return this.textures_.textureInfo;
  }

  private initStencil() {
    // We use the stencil buffer to mark pixels where primary objects
    // have been drawn, so that we can avoid overdrawing them with
    // fallback objects. We set up the stencil buffer to write 1s
    // where primary objects are drawn, and then configure it to
    // only draw fallback objects where the stencil value is not 1.
    this.gl_.stencilMask(0xff);
    this.gl_.clearStencil(stencilClearValue);
  }

  private renderLayer(layer: Layer, camera: Camera, frustum: Frustum) {
    this.state_.setBlendingMode(layer.transparent ? layer.blendMode : "none");

    const fallbackObjects = layer.fallbackObjects;
    const hasFallbackObjects = fallbackObjects.length > 0;

    this.state_.setStencilTest(hasFallbackObjects);
    if (hasFallbackObjects) {
      this.gl_.clear(this.gl_.STENCIL_BUFFER_BIT);
      this.gl_.stencilFunc(this.gl_.EQUAL, stencilClearValue, 0xff);
      this.gl_.stencilOp(this.gl_.KEEP, this.gl_.KEEP, this.gl_.INCR);
    }

    this.renderObjects(layer, layer.objects, camera, frustum);

    if (hasFallbackObjects) {
      this.renderObjects(layer, fallbackObjects, camera, frustum);
    }
  }

  private renderObjects(
    layer: Layer,
    objects: RenderableObject[],
    camera: Camera,
    frustum: Frustum
  ) {
    for (const object of objects) {
      if (frustum.intersectsWithBox3(object.boundingBox)) {
        this.renderObject(layer, object, camera);
      }
    }
  }

  protected renderObject(
    layer: Layer,
    object: RenderableObject,
    camera: Camera
  ) {
    this.state_.setCullFaceMode(object.cullFaceMode);
    this.bindings_.bindGeometry(object.geometry);
    object.popStaleTextures().forEach((texture) => {
      this.textures_.disposeTexture(texture);
    });
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

    this.renderedObjectsPerFrame_ += 1;
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
    const newViewport = new Box2(
      vec2.fromValues(0, 0),
      vec2.fromValues(width, height)
    );
    this.state_.setViewport(newViewport);
  }

  protected clear() {
    this.gl.clearColor(...this.backgroundColor.rgba);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    this.state_.setDepthTesting(true);
    this.gl.depthFunc(this.gl.LEQUAL);
  }

  private get gl() {
    return this.gl_;
  }
}
