import { Box2 } from "@/math/box2";
import { Camera } from "@/objects/cameras/camera";
import { Frustum } from "@/math/frustum";
import { Layer, BlendMode } from "@/core/layer";
import { Logger } from "@/utilities/logger";
import { Renderer } from "@/core/renderer";
import { Viewport } from "@/core/viewport";

import { vec2, mat4 } from "gl-matrix";

import WebGPUBindings from "./webgpu_bindings";
import WebGPUGeometryBuffers from "./webgpu_geometry_buffers";
import WebGPUTexturePool from "./webgpu_texture_pool";
import WebGPUPipelines, {
  ShaderName,
  WebGPUPipeline,
} from "./webgpu_pipelines";

import { RenderableObject } from "@/core/renderable_object";
import { Texture } from "@/objects/textures/texture";

// WebGL to WebGPU clip-space correction:
// 1. Flip Y (WebGPU framebuffer Y=0 is top)
// 2. Remap Z from [-1,1] to [0,1] (WebGPU depth range)
// prettier-ignore
const clipSpaceCorrection = mat4.fromValues(
  1.0,  0.0,  0.0,  0.0, // column 0
  0.0, -1.0,  0.0,  0.0, // column 1
  0.0,  0.0,  0.5,  0.0, // column 2
  0.0,  0.0,  0.5,  1.0  // column 3
);

export async function createWebGPURenderer(canvas: HTMLCanvasElement) {
  if (!navigator.gpu) {
    throw new Error("WebGPU is not supported in this browser");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("Failed to obtain a WebGPU Adapter");
  }

  const renderer = new WebGPURenderer(canvas, await adapter.requestDevice());
  await renderer.compileShaders();

  return renderer;
}

class WebGPURenderer extends Renderer {
  private readonly bindings_: WebGPUBindings;
  private readonly geometryBuffers_: WebGPUGeometryBuffers;
  private readonly pipelines_: WebGPUPipelines;
  private readonly texturePool_: WebGPUTexturePool;

  private readonly colorFormat_: GPUTextureFormat;
  private readonly context_: GPUCanvasContext;
  private readonly depthFormat_: GPUTextureFormat;
  private readonly device_: GPUDevice;

  private readonly currentProjection_ = mat4.create();
  private readonly currentModelView_ = mat4.create();

  private colorMSAATexture_: GPUTexture | null = null;
  private depthStencilTexture_: GPUTexture | null = null;
  private passEncoder_: GPURenderPassEncoder | null = null;

  private renderedObjectsPerFrame_ = 0;
  private needsClear_ = true;

  // Per-layer state set in renderLayer() and consumed by renderObject().
  // Kept as fields because renderObject's signature is fixed by the base class.
  private currentDepthWrite_ = true;
  private currentStencil_ = false;
  private currentBlendMode_: BlendMode = "none";
  private currentLayerOpacity_ = 1.0;

  constructor(canvas: HTMLCanvasElement, device: GPUDevice) {
    super(canvas);

    this.colorFormat_ = navigator.gpu.getPreferredCanvasFormat();
    this.depthFormat_ = "depth24plus-stencil8";
    this.device_ = device;

    const context = canvas.getContext("webgpu");
    if (!context) {
      throw new Error("Failed to initialize WebGPU context");
    }

    context.configure({
      device: this.device_,
      format: this.colorFormat_,
      alphaMode: "premultiplied",
    });

    this.context_ = context;
    this.bindings_ = new WebGPUBindings(device);
    this.geometryBuffers_ = new WebGPUGeometryBuffers(device);
    this.texturePool_ = new WebGPUTexturePool(device);
    this.pipelines_ = new WebGPUPipelines(
      device,
      this.colorFormat_,
      this.depthFormat_
    );

    Logger.info("WebGPURenderer", "WebGPU Initialized");

    this.resize(this.width, this.height);
  }

  public async compileShaders() {
    await Promise.all([
      this.pipelines_.compileShader("image_scalar_u32"),
      this.pipelines_.compileShader("image_scalar_i32"),
      this.pipelines_.compileShader("image_scalar_f32"),
      this.pipelines_.compileShader("wireframe"),
    ]);
  }

  public override beginFrame() {
    this.renderedObjects_ = 0;
    this.renderedObjectsPerFrame_ = 0;
    this.needsClear_ = true;
  }

  public override render(viewport: Viewport) {
    const { opaque, transparent } = viewport.layerManager.partitionLayers();
    for (const layer of [...opaque, ...transparent]) {
      layer.update({ viewport });
    }

    if (getComputedStyle(viewport.element).visibility === "hidden") return;

    const viewportBox = viewport.getBoxRelativeTo(this.canvas);
    const surfaceBox = new Box2(
      vec2.fromValues(0, 0),
      vec2.fromValues(this.width, this.height)
    );

    if (!Box2.intersects(viewportBox, surfaceBox)) {
      Logger.warn(
        "WebGPURenderer",
        `Viewport ${viewport.id} is entirely outside canvas bounds`
      );
      return;
    }

    const frustum = viewport.camera.frustum;
    const needsScissor = !Box2.equals(viewportBox.floor(), surfaceBox.floor());

    this.bindings_.clearUniformBindings();
    this.updateProjection(viewport.camera.projectionMatrix);

    this.currentDepthWrite_ = true;
    for (const layer of opaque) {
      if (layer.state === "ready") {
        this.renderLayer(
          layer,
          viewport.camera,
          frustum,
          viewportBox,
          needsScissor
        );
      }
    }

    this.currentDepthWrite_ = false;
    for (const layer of transparent) {
      if (layer.state === "ready") {
        this.renderLayer(
          layer,
          viewport.camera,
          frustum,
          viewportBox,
          needsScissor
        );
      }
    }

    this.renderedObjects_ = this.renderedObjectsPerFrame_;
  }

  private renderLayer(
    layer: Layer,
    camera: Camera,
    frustum: Frustum,
    viewportBox: Box2,
    needsScissor: boolean
  ) {
    if (layer.type !== "ImageLayer") {
      throw new Error(
        "Experimental WebGPU renderer only supports image layers"
      );
    }

    if (layer.objects.length === 0) return;

    // One render pass (and one command encoder) per layer. WebGPU has no
    // in-pass stencil clear, so a fresh pass per layer is the simplest
    // equivalent of WebGL's per-layer `clear(STENCIL_BUFFER_BIT)`.
    // If we do channel blending without the stencil buffer we could use
    // a single render pass for all layers.
    const commandEncoder = this.device_.createCommandEncoder();
    this.passEncoder_ = this.beginRenderPass(commandEncoder);

    const { x, y, width, height } = viewportBox.floor().toRect();
    this.passEncoder_.setViewport(x, y, width, height, 0, 1);
    if (needsScissor) {
      this.passEncoder_.setScissorRect(x, y, width, height);
    }

    this.currentStencil_ = layer.hasMultipleLODs();
    if (this.currentStencil_) {
      this.passEncoder_.setStencilReference(0);
    }

    this.currentBlendMode_ = layer.blendMode;
    this.currentLayerOpacity_ = layer.opacity;

    layer.objects.forEach((object, i) => {
      if (frustum.intersectsWithBox3(object.boundingBox)) {
        this.renderObject(layer, i, camera);
        this.renderedObjectsPerFrame_ += 1;
      }
    });

    this.passEncoder_.end();
    this.device_.queue.submit([commandEncoder.finish()]);
    this.passEncoder_ = null;
  }

  protected override renderObject(
    layer: Layer,
    objectIndex: number,
    camera: Camera
  ) {
    const object = layer.objects[objectIndex];

    if (object.type !== "ImageRenderable") {
      throw new Error(
        "Experimental WebGPU renderer only supports image renderables"
      );
    }

    object.popStaleTextures().forEach((texture) => {
      this.texturePool_.dispose(texture);
    });

    if (!object.programName) return;

    const renderPass = this.passEncoder_!;
    const geometryBuffer = this.geometryBuffers_.get(object.geometry);

    const pipeline = this.pipelines_.get(
      {
        shaderName: shaderNameForTexture(object.textures[0]),
        depthWrite: this.currentDepthWrite_,
        depthTest: object.depthTest,
        stencil: this.currentStencil_,
        blendMode: this.currentBlendMode_,
        cullMode: "back",
        topology: "triangle-list",
        vertexAttributesStr: geometryBuffer.attributesKey,
      },
      geometryBuffer
    );

    renderPass.setPipeline(pipeline.pipeline);

    this.setUniformsForObject(object, pipeline, camera);
    this.setTexturesForObject(object, pipeline);

    renderPass.setVertexBuffer(0, geometryBuffer.vertexBuffer);
    if (geometryBuffer.indexBuffer) {
      renderPass.setIndexBuffer(geometryBuffer.indexBuffer, "uint32");
      renderPass.drawIndexed(object.geometry.indexData.length);
    } else {
      renderPass.draw(object.geometry.vertexCount);
    }

    if (object.wireframeEnabled) {
      this.renderWireframe(object, camera);
    }
  }

  private renderWireframe(object: RenderableObject, camera: Camera) {
    const wireframeGeometry = object.wireframeGeometry;
    if (wireframeGeometry.indexData.length === 0) return;

    const renderPass = this.passEncoder_!;
    const geometryBuffer = this.geometryBuffers_.get(wireframeGeometry);

    const pipeline = this.pipelines_.get(
      {
        shaderName: "wireframe",
        depthWrite: this.currentDepthWrite_,
        depthTest: object.depthTest,
        stencil: this.currentStencil_,
        blendMode: this.currentBlendMode_,
        cullMode: "none",
        topology: "line-list",
        vertexAttributesStr: geometryBuffer.attributesKey,
      },
      geometryBuffer
    );

    renderPass.setPipeline(pipeline.pipeline);

    mat4.multiply(
      this.currentModelView_,
      camera.viewMatrix,
      object.transform.matrix
    );

    pipeline.uniformsView.set({
      projection: this.currentProjection_,
      modelView: this.currentModelView_,
      color: object.wireframeColor.rgb,
      opacity: this.currentLayerOpacity_,
    });

    this.bindings_.setUniforms(renderPass, pipeline);

    renderPass.setVertexBuffer(0, geometryBuffer.vertexBuffer);
    if (geometryBuffer.indexBuffer) {
      renderPass.setIndexBuffer(geometryBuffer.indexBuffer, "uint32");
      renderPass.drawIndexed(wireframeGeometry.indexData.length);
    }
  }

  protected override resize(width: number, height: number) {
    if (this.colorMSAATexture_) {
      this.colorMSAATexture_.destroy();
    }

    this.colorMSAATexture_ = this.device_.createTexture({
      size: { width, height },
      format: this.colorFormat_,
      sampleCount: 4,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    if (this.depthStencilTexture_) {
      this.depthStencilTexture_.destroy();
    }

    this.depthStencilTexture_ = this.device_.createTexture({
      size: { width, height },
      format: this.depthFormat_,
      sampleCount: 4,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  private beginRenderPass(encoder: GPUCommandEncoder) {
    const loadOp: GPULoadOp = this.needsClear_ ? "clear" : "load";
    this.needsClear_ = false;
    return encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.colorMSAATexture_!.createView(),
          resolveTarget: this.context_.getCurrentTexture().createView(),
          loadOp,
          storeOp: "store",
          clearValue: {
            r: this.backgroundColor.r,
            g: this.backgroundColor.g,
            b: this.backgroundColor.b,
            a: this.backgroundColor.a,
          },
        },
      ],
      depthStencilAttachment: {
        view: this.depthStencilTexture_!.createView(),
        depthLoadOp: loadOp,
        depthStoreOp: "store",
        depthClearValue: 1.0,
        stencilLoadOp: "clear",
        stencilStoreOp: "store",
        stencilClearValue: 0,
      },
    });
  }

  protected override clear() {
    // No-op. In WebGPU, clearing is handled by the render pass loadOp
    // in beginRenderPass(). There is no imperative clear command.
  }

  private setUniformsForObject(
    object: RenderableObject,
    pipeline: WebGPUPipeline,
    camera: Camera
  ) {
    mat4.multiply(
      this.currentModelView_,
      camera.viewMatrix,
      object.transform.matrix
    );

    const uniforms = object.getUniforms();
    const objectOpacity = (uniforms.Opacity as number | undefined) ?? 1;

    pipeline.uniformsView.set({
      projection: this.currentProjection_,
      modelView: this.currentModelView_,
      color: uniforms.Color,
      valueOffset: uniforms.ValueOffset,
      valueScale: uniforms.ValueScale,
      opacity: this.currentLayerOpacity_ * objectOpacity,
    });

    this.bindings_.setUniforms(this.passEncoder_!, pipeline);
  }

  private setTexturesForObject(
    object: RenderableObject,
    pipeline: WebGPUPipeline
  ) {
    if (object.textures.length > 1) {
      throw new Error(
        "Experimental WebGPU renderer only supports single textures"
      );
    }

    this.bindings_.setTexture(
      this.passEncoder_!,
      pipeline,
      this.texturePool_.get(object.textures[0])
    );
  }

  private updateProjection(projectionMatrix: mat4) {
    mat4.multiply(
      this.currentProjection_,
      clipSpaceCorrection,
      projectionMatrix
    );
  }
}

function shaderNameForTexture(texture: Texture): ShaderName {
  switch (texture.dataType) {
    case "byte":
    case "unsigned_byte":
    case "float":
      return "image_scalar_f32";
    case "short":
    case "int":
      return "image_scalar_i32";
    case "unsigned_short":
    case "unsigned_int":
      return "image_scalar_u32";
  }
}
