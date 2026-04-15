import { Box2 } from "@/math/box2";
import { Camera } from "@/objects/cameras/camera";
import { Frustum } from "@/math/frustum";
import { Layer } from "@/core/layer";
import { Logger } from "@/utilities/logger";
import { Renderer } from "@/core/renderer";
import { Viewport } from "@/core/viewport";

import { vec2 } from "gl-matrix";

import WebGPUShaderLibrary from "./webgpu_shader_library";
import WebGPUPipelines from "./webgpu_pipelines";
import WebGPUGeometryBuffers from "./webgpu_geometry_buffers";

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
  private readonly device_: GPUDevice;
  private readonly colorFormat_: GPUTextureFormat;
  private readonly context_: GPUCanvasContext;
  private readonly shaderLibrary_: WebGPUShaderLibrary;
  private readonly pipelines_: WebGPUPipelines;
  private readonly geometryBuffers_: WebGPUGeometryBuffers;
  private readonly depthFormat_: GPUTextureFormat;

  private depthStencilTexture_: GPUTexture | null = null;
  private passEncoder_: GPURenderPassEncoder | null = null;

  private renderedObjectsPerFrame_ = 0;
  private currentDepthWrite_ = true;
  private currentStencil_ = false;
  private needsClear_ = true;

  constructor(canvas: HTMLCanvasElement, device: GPUDevice) {
    super(canvas);

    this.device_ = device;
    this.colorFormat_ = navigator.gpu.getPreferredCanvasFormat();
    this.depthFormat_ = "depth24plus-stencil8";
    this.shaderLibrary_ = new WebGPUShaderLibrary(device);
    this.geometryBuffers_ = new WebGPUGeometryBuffers(device);

    this.pipelines_ = new WebGPUPipelines(
      device,
      this.shaderLibrary_,
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
    await this.shaderLibrary_.compile("basic_passthrough");
  }

  public override beginFrame() {
    this.needsClear_ = true;
  }

  public override render(viewport: Viewport) {
    this.renderedObjects_ = 0;
    this.renderedObjectsPerFrame_ = 0;

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
    if (layer.type !== "ImageLayer") {
      throw new Error("Experimental WebGPU renderer only support image layers");
    }

    if (layer.objects.length === 0) {
      return;
    }

    this.currentStencil_ = layer.hasMultipleLODs();
    if (this.currentStencil_) {
      this.passEncoder_!.setStencilReference(0);
    }

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
    _camera: Camera
  ) {
    const object = layer.objects[objectIndex];
    if (!object.programName) return;

    const renderPass = this.passEncoder_!;
    const geometryBuffer = this.geometryBuffers_.get(object.geometry);

    renderPass.setPipeline(
      this.pipelines_.get(
        {
          shaderName: "basic_passthrough",
          depthWrite: this.currentDepthWrite_,
          depthTest: object.depthTest,
          stencil: this.currentStencil_,
          cullMode: "back",
          topology: "triangle-list",
          vertexAttributesStr: geometryBuffer.attributesKey,
        },
        geometryBuffer
      )
    );
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
}
