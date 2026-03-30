import { mat4, vec2, vec3, vec4 } from "gl-matrix";
import type { Geometry, Primitive } from "../core/geometry";
import type { Layer } from "../core/layer";
import type { RenderableObject } from "../core/renderable_object";
import { Renderer } from "../core/renderer";
import type { Viewport } from "../core/viewport";
import { Box2 } from "../math/box2";
import type { Frustum } from "../math/frustum";
import type { Camera } from "../objects/cameras/camera";
import { Logger } from "../utilities/logger";
import { WebGLState } from "./WebGLState";
import { WebGLBuffers } from "./webgl_buffers";
import { DownsampledFramebuffer } from "./webgl_framebuffers";
import type { WebGLShaderProgram } from "./webgl_shader_program";
import { WebGLShaderPrograms } from "./webgl_shader_programs";
import { WebGLTextures } from "./webgl_textures";

// Idetik defines screen-space with +Y pointing downward.
// With the default camera, the basis vectors are:
// (1, 0, 0) → right
// (0, 1, 0) → down
// (0, 0, 1) → out of the screen
//
// To match this convention, we flip Y in the projection matrix.
// This is a mirror transform, which also flips triangle winding.
const axisDirection = mat4.fromScaling(mat4.create(), [1, -1, 1]);

class DownsamplingCompositePass {
  private readonly gl_: WebGL2RenderingContext;
  private readonly state_: WebGLState;
  private readonly vao_: WebGLVertexArrayObject;

  constructor(gl: WebGL2RenderingContext, state: WebGLState) {
    this.gl_ = gl;
    this.state_ = state;
    this.vao_ = gl.createVertexArray();
  }

  private begin() {
    this.state_.setDepthTesting(false);
    this.state_.setDepthMask(false);
    this.state_.setCullFaceMode("none");
    this.state_.setStencilTest(false);
  }

  draw(buffer: DownsampledFramebuffer, programs: WebGLShaderPrograms) {
    this.begin();
    this.draw_(buffer, programs);
    this.end();
  }

  private draw_(buffer: DownsampledFramebuffer, programs: WebGLShaderPrograms) {
    this.gl_.bindVertexArray(this.vao_);
    buffer.bindTexture();
    this.gl_.enable(this.gl_.BLEND);
    this.gl_.blendFunc(this.gl_.ONE, this.gl_.ONE_MINUS_SRC_ALPHA);
    const program = programs.use("downsampleComposite");
    program.setUniform("u_texture", 0);
    this.gl_.drawArrays(this.gl_.TRIANGLES, 0, 3);
  }

  private end() {
    this.gl_.bindVertexArray(null);
    this.state_.setDepthMask(true);
  }

  dispose() {
    this.gl_.deleteVertexArray(this.vao_);
  }
}

export class WebGLRenderer extends Renderer {
  private readonly gl_: WebGL2RenderingContext;
  private readonly programs_: WebGLShaderPrograms;
  private readonly bindings_: WebGLBuffers;
  private readonly textures_: WebGLTextures;
  private readonly state_: WebGLState;
  private readonly downsamplingPass_: DownsamplingCompositePass;
  private downsamplingFramebuffer_: DownsampledFramebuffer | undefined;
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
    this.downsamplingPass_ = new DownsamplingCompositePass(gl, this.state_);
    this.initStencil();
    this.resize(this.canvas.width, this.canvas.height);
  }

  public render(viewport: Viewport) {
    let viewportIsVisible =
      getComputedStyle(viewport.element).visibility !== "hidden";
    const viewportBox = viewport.getBoxRelativeTo(this.canvas);
    const scissorBox = this.computeScissorBox(viewportBox);

    if (scissorBox === null) {
      Logger.warn(
        "WebGLRenderer",
        `Viewport ${viewport.id} is entirely outside canvas bounds, skipping render`
      );
      viewportIsVisible = false;
    }
    this.applyScissor(scissorBox);

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

    if (viewportIsVisible) {
      const isDownsampling = this.beginDownsampling(
        viewport,
        viewportBox,
        transparent.length > 0
      );

      this.state_.setDepthMask(false);
      for (const layer of transparent) {
        layer.update(renderContext);
        if (layer.state === "ready") {
          this.renderLayer(layer, viewport.camera, frustum);
        }
      }
      this.state_.setDepthMask(true);

      if (isDownsampling) {
        this.endDownsampling(viewportBox, scissorBox);
      }
    }

    this.renderedObjects_ = this.renderedObjectsPerFrame_;
  }

  public get textureInfo() {
    return this.textures_.textureInfo;
  }

  private beginDownsampling(
    viewport: Viewport,
    viewportBox: Box2,
    hasLayers: boolean
  ): boolean {
    const cameraIsMoving = viewport.cameraControls?.isMoving ?? false;
    if (!cameraIsMoving || !hasLayers || viewport.downsamplingFactor <= 1) {
      return false;
    }

    const { width: vpWidth, height: vpHeight } = viewportBox.toRect();
    const dsFactor = viewport.downsamplingFactor;
    const dsWidth = Math.max(1, Math.floor(vpWidth / dsFactor));
    const dsHeight = Math.max(1, Math.floor(vpHeight / dsFactor));

    if (!this.downsamplingFramebuffer_) {
      this.downsamplingFramebuffer_ = new DownsampledFramebuffer(
        this.gl_,
        dsWidth,
        dsHeight
      );
    } else {
      this.downsamplingFramebuffer_.resize(dsWidth, dsHeight);
    }

    this.downsamplingFramebuffer_.begin();
    const downscaledViewport = new Box2(
      vec2.fromValues(0, 0),
      vec2.fromValues(dsWidth, dsHeight)
    );
    this.state_.setViewport(downscaledViewport);
    this.state_.setScissorTest(false);

    return true;
  }

  private endDownsampling(
    viewportBox: Box2,
    scissorBox: Box2 | null | undefined
  ) {
    // null-assertions are ok here, we are sure downsamplingFramebuffer_ is not undefined
    this.downsamplingFramebuffer_!.end();
    this.state_.setViewport(viewportBox);
    this.applyScissor(scissorBox);
    this.downsamplingPass_.draw(this.downsamplingFramebuffer_!, this.programs_);
    this.bindings_.invalidateActiveGeometry();
  }

  // Returns the scissor box if clipping is needed,
  // - undefined if not
  // - null if viewport is outside canvas
  private computeScissorBox(viewportBox: Box2): Box2 | undefined | null {
    const rendererBox = new Box2(
      vec2.fromValues(0, 0),
      vec2.fromValues(this.width, this.height)
    );
    if (Box2.equals(viewportBox.floor(), rendererBox.floor())) {
      return undefined;
    }
    if (Box2.intersects(viewportBox, rendererBox)) {
      return viewportBox;
    }
    return null;
  }

  private applyScissor(scissorBox: Box2 | null | undefined) {
    if (scissorBox) {
      this.state_.setScissor(scissorBox);
      this.state_.setScissorTest(true);
      return;
    }
    this.state_.setScissorTest(false);
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
          const inverseModelView = mat4.invert(mat4.create(), modelView);
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
