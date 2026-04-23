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
import WebGPUPipelines, { WebGPUPipeline } from "./webgpu_pipelines";
import WebGPUTexturePool from "./webgpu_texture_pool";

import { RenderableObject } from "@/core/renderable_object";

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

class WebGPURenderer extends Renderer {
  private readonly colorFormat_: GPUTextureFormat;
  private readonly context_: GPUCanvasContext;
  private readonly depthFormat_: GPUTextureFormat;
  private readonly device_: GPUDevice;

  private readonly bindings_: WebGPUBindings;
  private readonly geometryBuffers_: WebGPUGeometryBuffers;
  private readonly pipelines_: WebGPUPipelines;
  private readonly texturePool_: WebGPUTexturePool;

  private depthStencilTexture_: GPUTexture | null = null;
  private passEncoder_: GPURenderPassEncoder | null = null;

  private renderedObjectsPerFrame_ = 0;
  private currentDepthWrite_ = true;
  private currentStencil_ = false;
  private currentBlendMode_: BlendMode = "none";
  private currentOpacity_ = 1.0;
  private needsClear_ = true;

  private readonly currentProjection_ = mat4.create();
  private readonly scratchModelView_ = mat4.create();

  constructor(canvas: HTMLCanvasElement, device: GPUDevice) {
    super(canvas);

    this.colorFormat_ = navigator.gpu.getPreferredCanvasFormat();
    this.depthFormat_ = "depth24plus-stencil8";
    this.device_ = device;

    this.bindings_ = new WebGPUBindings(device);
    this.geometryBuffers_ = new WebGPUGeometryBuffers(device);
    this.texturePool_ = new WebGPUTexturePool(device);
    this.pipelines_ = new WebGPUPipelines(
      device,
      this.colorFormat_,
      this.depthFormat_
    );

    const context = canvas.getContext("webgpu");
    if (!context) {
      throw new Error("Failed to initialize WebGPU context");
    }

    this.context_ = context;
    this.context_.configure({
      device: this.device_,
      format: this.colorFormat_,
      alphaMode: "opaque",
    });

    Logger.info("WebGPURenderer", "WebGPU Initialized");

    this.resize(this.width, this.height);
  }

  public async compileShaders() {
    await this.pipelines_.compileShader("image_scalar_unsigned");
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

    const commandEncoder = this.device_.createCommandEncoder();
    this.passEncoder_ = this.beginRenderPass(commandEncoder);

    const { x, y, width, height } = viewportBox.floor().toRect();
    this.passEncoder_.setViewport(x, y, width, height, 0, 1);

    if (!Box2.equals(viewportBox.floor(), surfaceBox.floor())) {
      this.passEncoder_.setScissorRect(x, y, width, height);
    }

    const frustum = viewport.camera.frustum;

    this.bindings_.clear();

    this.updateProjection(viewport.camera.projectionMatrix);

    this.currentDepthWrite_ = true;
    for (const layer of opaque) {
      if (layer.state === "ready") {
        this.renderLayer(layer, viewport.camera, frustum);
      }
    }

    this.currentDepthWrite_ = false;
    for (const layer of transparent) {
      if (layer.state === "ready") {
        this.renderLayer(layer, viewport.camera, frustum);
      }
    }

    this.passEncoder_.end();
    this.device_.queue.submit([commandEncoder.finish()]);
    this.renderedObjects_ = this.renderedObjectsPerFrame_;
  }

  private renderLayer(layer: Layer, camera: Camera, frustum: Frustum) {
    if (!this.passEncoder_) return;

    if (layer.type !== "ImageLayer") {
      throw new Error(
        "Experimental WebGPU renderer only supports image layers"
      );
    }

    if (layer.objects.length === 0) {
      return;
    }

    this.currentStencil_ = layer.hasMultipleLODs();
    if (this.currentStencil_) {
      this.passEncoder_.setStencilReference(0);
    }

    this.currentBlendMode_ = layer.transparent ? layer.blendMode : "none";
    this.currentOpacity_ = layer.opacity;

    layer.objects.forEach((object, i) => {
      if (frustum.intersectsWithBox3(object.boundingBox)) {
        this.renderObject(layer, i, camera);
        this.renderedObjectsPerFrame_ += 1;
      }
    });
  }

  protected override renderObject(
    layer: Layer,
    objectIndex: number,
    camera: Camera
  ) {
    const object = layer.objects[objectIndex];
    object.popStaleTextures().forEach((texture) => {
      this.texturePool_.dispose(texture);
    });

    if (!object.programName) return;

    const renderPass = this.passEncoder_!;
    const geometryBuffer = this.geometryBuffers_.get(object.geometry);

    const pipeline = this.pipelines_.get(
      {
        shaderName: "image_scalar_unsigned",
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

    renderPass.setVertexBuffer(0, geometryBuffer.vertex);
    if (geometryBuffer.index) {
      renderPass.setIndexBuffer(geometryBuffer.index, "uint32");
      renderPass.drawIndexed(object.geometry.indexData.length);
    } else {
      renderPass.draw(object.geometry.vertexCount);
    }
  }

  protected override resize(width: number, height: number) {
    if (this.depthStencilTexture_) {
      this.depthStencilTexture_.destroy();
    }
    this.depthStencilTexture_ = this.device_.createTexture({
      size: { width, height },
      format: this.depthFormat_,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  private beginRenderPass(encoder: GPUCommandEncoder) {
    const colorAttachment = this.context_.getCurrentTexture().createView();
    const depthAttachment = this.depthStencilTexture_!.createView();
    const loadOp: GPULoadOp = this.needsClear_ ? "clear" : "load";
    this.needsClear_ = false;
    return encoder.beginRenderPass({
      colorAttachments: [
        {
          view: colorAttachment,
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
        view: depthAttachment,
        depthLoadOp: loadOp,
        depthStoreOp: "store",
        depthClearValue: 1.0,
        stencilLoadOp: loadOp,
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
    if (!this.passEncoder_) {
      throw new Error(
        "Valid render pass encoder must be set before updating uniforms"
      );
    }

    if (object.type !== "ImageRenderable") {
      throw new Error(
        "Experimental WebGPU renderer only supports image renderables"
      );
    }

    const modelView = mat4.multiply(
      this.scratchModelView_,
      camera.viewMatrix,
      object.transform.matrix
    );

    const uniforms = object.getUniforms();

    pipeline.uniformsView.set({
      projection: this.currentProjection_,
      modelView,
      color: uniforms.Color,
      valueOffset: uniforms.ValueOffset,
      valueScale: uniforms.ValueScale,
      opacity: this.currentOpacity_,
    });

    this.bindings_.setUniforms(this.passEncoder_, pipeline);
  }

  private setTexturesForObject(
    object: RenderableObject,
    pipeline: WebGPUPipeline
  ) {
    if (!this.passEncoder_) {
      throw new Error(
        "Valid render pass encoder must be set before updating textures"
      );
    }

    if (object.type !== "ImageRenderable") {
      throw new Error(
        "Experimental WebGPU renderer only supports image renderables"
      );
    }

    if (object.textures.length > 1) {
      throw new Error(
        "Experimental WebGPU renderer only supports single textures"
      );
    }

    this.bindings_.setTexture(
      this.passEncoder_,
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
