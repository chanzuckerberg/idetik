import { Box2 } from "@/math/box2";
import { Camera } from "@/objects/cameras/camera";
import { CullingMode } from "@/renderers/webgl_state";
import { Frustum } from "@/math/frustum";
import { Layer, BlendMode } from "@/core/layer";
import { Logger } from "@/utilities/logger";
import { Renderer } from "@/core/renderer";
import { Viewport } from "@/core/viewport";

import { vec2, vec4, mat4 } from "gl-matrix";

import WebGPUBindings from "./webgpu_bindings";
import WebGPUGeometryBuffers from "./webgpu_geometry_buffers";
import WebGPUPipelines, {
  ShaderName,
  WebGPUComputePipeline,
  WebGPUPipeline,
} from "./webgpu_pipelines";
import WebGPUTexturePool from "./webgpu_texture_pool";

import { RenderableObject } from "@/core/renderable_object";
import { Texture } from "@/objects/textures/texture";

const VOLUME_STORAGE_FORMAT: GPUTextureFormat = "rgba16float";
const COMPUTE_WORKGROUP_SIZE = 8;

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

  private colorMSAATexture_: GPUTexture | null = null;
  private depthStencilTexture_: GPUTexture | null = null;
  private passEncoder_: GPURenderPassEncoder | null = null;

  // Storage target for volume compute output. Canvas-sized, rgba16float.
  // Re-created on every resize; bind groups against it are invalidated then.
  private volumeStorageTexture_: GPUTexture | null = null;
  private volumeStorageWriteGroup_: GPUBindGroup | null = null;
  private volumeStorageSampleGroup_: GPUBindGroup | null = null;

  private renderedObjectsPerFrame_ = 0;
  private needsClear_ = true;

  private readonly currentProjection_ = mat4.create();
  private readonly scratchModelView_ = mat4.create();

  // Per-layer state set in renderLayer() and consumed by renderObject().
  // Kept as fields because renderObject's signature is fixed by the base class.
  private currentDepthWrite_ = true;
  private currentStencil_ = false;
  private currentBlendMode_: BlendMode = "none";
  private currentOpacity_ = 1.0;

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
      alphaMode: "premultiplied",
    });

    Logger.info("WebGPURenderer", "WebGPU Initialized");

    this.resize(this.width, this.height);
  }

  public async compileShaders() {
    await Promise.all([
      this.pipelines_.compileShader("image_scalar_u32"),
      this.pipelines_.compileShader("image_scalar_i32"),
      this.pipelines_.compileShader("image_scalar_f32"),
      this.pipelines_.compileShader("wireframe"),
      this.pipelines_.compileComputeShader("volume_compute_u32"),
      this.pipelines_.compileComposite(this.colorFormat_),
    ]);
    this.rebuildVolumeStorageBindGroups();
  }

  private rebuildVolumeStorageBindGroups() {
    if (!this.volumeStorageTexture_) return;

    // No-op if pipelines haven't been compiled yet (e.g., resize from
    // constructor). compileShaders() calls this again afterward.
    let computeLayouts: WebGPUComputePipeline["layouts"];
    let compositeLayout: GPUBindGroupLayout;
    try {
      computeLayouts = this.pipelines_.getCompute("volume_compute_u32").layouts;
      compositeLayout = this.pipelines_.getComposite().textureLayout;
    } catch {
      return;
    }

    const view = this.volumeStorageTexture_.createView();
    this.volumeStorageWriteGroup_ = this.device_.createBindGroup({
      layout: computeLayouts.storage,
      entries: [{ binding: 0, resource: view }],
    });
    this.volumeStorageSampleGroup_ = this.device_.createBindGroup({
      layout: compositeLayout,
      entries: [{ binding: 0, resource: view }],
    });
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

    this.bindings_.clear();
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
    if (layer.type !== "ImageLayer" && layer.type !== "VolumeLayer") {
      throw new Error(
        `Experimental WebGPU renderer does not support layer type ${layer.type}`
      );
    }

    if (layer.objects.length === 0) return;

    this.currentBlendMode_ = layer.transparent ? layer.blendMode : "none";
    this.currentOpacity_ = layer.opacity;

    if (layer.type === "VolumeLayer") {
      this.renderVolumeLayer(layer, camera, frustum, viewportBox, needsScissor);
    } else {
      this.renderImageLayer(layer, camera, frustum, viewportBox, needsScissor);
    }
  }

  private renderImageLayer(
    layer: Layer,
    camera: Camera,
    frustum: Frustum,
    viewportBox: Box2,
    needsScissor: boolean
  ) {
    // One render pass (and one command encoder) per layer. WebGPU has no
    // in-pass stencil clear, so a fresh pass per layer is the simplest
    // equivalent of WebGL's per-layer `clear(STENCIL_BUFFER_BIT)`.
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

  private renderVolumeLayer(
    layer: Layer,
    camera: Camera,
    frustum: Frustum,
    viewportBox: Box2,
    needsScissor: boolean
  ) {
    this.currentStencil_ = false;

    const commandEncoder = this.device_.createCommandEncoder();
    const computePipeline = this.pipelines_.getCompute("volume_compute_u32");
    const compositePipeline = this.pipelines_.getComposite();

    const layerUniforms = layer.getUniforms();
    const { x, y, width, height } = viewportBox.floor().toRect();

    layer.objects.forEach((object) => {
      if (object.type !== "VolumeRenderable") {
        throw new Error(
          `Volume layer contained unexpected renderable type ${object.type}`
        );
      }
      if (!frustum.intersectsWithBox3(object.boundingBox)) return;
      if (object.programName !== "uintVolume") {
        throw new Error(
          `WebGPU volume rendering only supports unsigned data types (got ${object.programName})`
        );
      }

      object.popStaleTextures().forEach((texture) => {
        const gpuTexture = this.texturePool_.dispose(texture);
        if (gpuTexture) this.bindings_.removeTexture(gpuTexture);
      });

      this.dispatchVolumeCompute(
        commandEncoder,
        computePipeline,
        object,
        camera,
        layerUniforms,
        { x, y, width, height }
      );
      this.compositeVolumeOutput(
        commandEncoder,
        compositePipeline,
        { x, y, width, height },
        needsScissor
      );

      this.renderedObjectsPerFrame_ += 1;
    });

    this.device_.queue.submit([commandEncoder.finish()]);
  }

  private dispatchVolumeCompute(
    encoder: GPUCommandEncoder,
    pipeline: WebGPUComputePipeline,
    object: RenderableObject,
    camera: Camera,
    layerUniforms: Record<string, unknown>,
    rect: { x: number; y: number; width: number; height: number }
  ) {
    const objectUniforms = object.getUniforms();

    // clipToModel = inverse(camera.projection * camera.view * model). Note we
    // use the *raw* projection matrix (not the WebGPU-corrected one) because
    // we're reconstructing rays in camera-natural NDC space.
    const projView = mat4.multiply(
      scratchProjView,
      camera.projectionMatrix,
      camera.viewMatrix
    );
    const projViewModel = mat4.multiply(
      scratchProjViewModel,
      projView,
      object.transform.matrix
    );
    const clipToModel = mat4.invert(scratchClipToModel, projViewModel)!;

    const modelView = mat4.multiply(
      this.scratchModelView_,
      camera.viewMatrix,
      object.transform.matrix
    );
    const cameraInModel = vec4.transformMat4(
      scratchCameraInModel,
      cameraOrigin,
      mat4.invert(scratchInverseModelView, modelView)!
    );

    pipeline.uniformsView.set({
      clipToModel,
      cameraPositionModel: [
        cameraInModel[0],
        cameraInModel[1],
        cameraInModel[2],
      ],
      voxelScale: objectUniforms.VoxelScale,
      viewportOffset: [rect.x, rect.y],
      viewportSize: [rect.width, rect.height],
      visible: objectUniforms.Visible,
      valueOffset: objectUniforms.ValueOffset,
      valueScale: objectUniforms.ValueScale,
      colors: padColorsToRgba(objectUniforms["Color[0]"] as number[]),
      relativeStepSize: layerUniforms.RelativeStepSize,
      opacityMultiplier: layerUniforms.OpacityMultiplier,
      earlyTerminationAlpha: layerUniforms.EarlyTerminationAlpha,
      debugShowDegenerateRays: layerUniforms.DebugShowDegenerateRays,
    });

    const computePass = encoder.beginComputePass();
    computePass.setPipeline(pipeline.pipeline);
    this.bindings_.setUniforms(computePass, pipeline);
    this.bindings_.setTextures(
      computePass,
      pipeline,
      this.gatherVolumeTextures(object)
    );
    computePass.setBindGroup(2, this.volumeStorageWriteGroup_!);
    computePass.dispatchWorkgroups(
      Math.ceil(rect.width / COMPUTE_WORKGROUP_SIZE),
      Math.ceil(rect.height / COMPUTE_WORKGROUP_SIZE),
      1
    );
    computePass.end();
  }

  private compositeVolumeOutput(
    encoder: GPUCommandEncoder,
    pipeline: { pipeline: GPURenderPipeline },
    rect: { x: number; y: number; width: number; height: number },
    needsScissor: boolean
  ) {
    const pass = this.beginRenderPass(encoder);
    pass.setViewport(rect.x, rect.y, rect.width, rect.height, 0, 1);
    if (needsScissor) {
      pass.setScissorRect(rect.x, rect.y, rect.width, rect.height);
    }
    pass.setPipeline(pipeline.pipeline);
    pass.setBindGroup(0, this.volumeStorageSampleGroup_!);
    pass.draw(3);
    pass.end();
  }

  private gatherVolumeTextures(object: RenderableObject): GPUTexture[] {
    const dummy = this.texturePool_.dummy3D();
    const textures: GPUTexture[] = [];
    for (let i = 0; i < 4; i++) {
      const tex = object.textures[i];
      textures.push(tex ? this.texturePool_.get(tex) : dummy);
    }
    return textures;
  }

  protected override renderObject(
    layer: Layer,
    objectIndex: number,
    camera: Camera
  ) {
    const object = layer.objects[objectIndex];

    if (object.type !== "ImageRenderable") {
      throw new Error(
        `Experimental WebGPU renderer does not support renderable type ${object.type}`
      );
    }

    object.popStaleTextures().forEach((texture) => {
      const gpuTexture = this.texturePool_.dispose(texture);
      if (gpuTexture) this.bindings_.removeTexture(gpuTexture);
    });

    if (!object.programName) return;

    const renderPass = this.passEncoder_!;
    const geometryBuffer = this.geometryBuffers_.get(object.geometry);

    const pipeline = this.pipelines_.get(
      {
        shaderName: shaderNameForImageTexture(object.textures[0]),
        depthWrite: this.currentDepthWrite_,
        depthTest: object.depthTest,
        stencil: this.currentStencil_,
        blendMode: this.currentBlendMode_,
        cullMode: gpuCullMode(object.cullFaceMode),
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

    const modelView = mat4.multiply(
      this.scratchModelView_,
      camera.viewMatrix,
      object.transform.matrix
    );

    pipeline.uniformsView.set({
      projection: this.currentProjection_,
      modelView,
      color: object.wireframeColor.rgb,
      opacity: this.currentOpacity_,
    });

    this.bindings_.setUniforms(renderPass, pipeline);

    renderPass.setVertexBuffer(0, geometryBuffer.vertex);
    if (geometryBuffer.index) {
      renderPass.setIndexBuffer(geometryBuffer.index, "uint32");
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

    this.resizeVolumeStorage(width, height);
  }

  private resizeVolumeStorage(width: number, height: number) {
    if (this.volumeStorageTexture_) {
      this.volumeStorageTexture_.destroy();
    }

    this.volumeStorageTexture_ = this.device_.createTexture({
      size: { width, height },
      format: VOLUME_STORAGE_FORMAT,
      usage:
        GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });

    // Bind groups depend on pipeline layouts that aren't compiled yet on the
    // first call (constructor resize). compileShaders() will rebuild them.
    this.volumeStorageWriteGroup_ = null;
    this.volumeStorageSampleGroup_ = null;
    this.rebuildVolumeStorageBindGroups();
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
    const modelView = mat4.multiply(
      this.scratchModelView_,
      camera.viewMatrix,
      object.transform.matrix
    );

    const objectUniforms = object.getUniforms();

    pipeline.uniformsView.set({
      projection: this.currentProjection_,
      modelView,
      color: objectUniforms.Color,
      valueOffset: objectUniforms.ValueOffset,
      valueScale: objectUniforms.ValueScale,
      opacity: this.currentOpacity_,
    });

    this.bindings_.setUniforms(this.passEncoder_!, pipeline);
  }

  private setTexturesForObject(
    object: RenderableObject,
    pipeline: WebGPUPipeline
  ) {
    if (object.textures.length > 1) {
      throw new Error(
        "Experimental WebGPU renderer only supports single textures for images"
      );
    }

    this.bindings_.setTextures(this.passEncoder_!, pipeline, [
      this.texturePool_.get(object.textures[0]),
    ]);
  }

  private updateProjection(projectionMatrix: mat4) {
    mat4.multiply(
      this.currentProjection_,
      clipSpaceCorrection,
      projectionMatrix
    );
  }
}

function gpuCullMode(mode: CullingMode): GPUCullMode {
  switch (mode) {
    case "none":
      return "none";
    case "front":
      return "front";
    case "back":
      return "back";
    case "both":
      throw new Error("WebGPU does not support 'both' cull mode");
  }
}

const cameraOrigin = vec4.fromValues(0, 0, 0, 1);
const scratchCameraInModel = vec4.create();
const scratchInverseModelView = mat4.create();
const scratchProjView = mat4.create();
const scratchProjViewModel = mat4.create();
const scratchClipToModel = mat4.create();

function shaderNameForImageTexture(texture: Texture): ShaderName {
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

// WGSL `array<vec4f, 4>` expects 16 floats; volume_renderable returns 12
// (rgb per channel). Pad each rgb triple with a 0 alpha slot.
function padColorsToRgba(rgb: number[]): number[] {
  const out = new Array<number>(16);
  for (let i = 0; i < 4; i++) {
    out[i * 4 + 0] = rgb[i * 3 + 0];
    out[i * 4 + 1] = rgb[i * 3 + 1];
    out[i * 4 + 2] = rgb[i * 3 + 2];
    out[i * 4 + 3] = 0;
  }
  return out;
}
