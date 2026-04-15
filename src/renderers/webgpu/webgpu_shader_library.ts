import { Logger } from "@/utilities/logger";

import shaderImage from "./shaders/image.wgsl";

import {
  FrameUniformsDef,
  LayerUniformsDef,
  ImageObjectDefs,
} from "./webgpu_uniform_defs";

export type ShaderName = "image";

export type WebGPUShader = {
  name: ShaderName;
  module: GPUShaderModule;
  bindGroupLayouts: GPUBindGroupLayout[];
};

export default class WebGPUShaderLibrary {
  private readonly device_: GPUDevice;
  private readonly frameLayout_: GPUBindGroupLayout;
  private readonly layerLayout_: GPUBindGroupLayout;
  private readonly shaders_: WebGPUShader[];

  constructor(device: GPUDevice) {
    this.device_ = device;
    this.shaders_ = [];

    this.frameLayout_ = this.device_.createBindGroupLayout({
      entries: FrameUniformsDef.entries,
    });

    this.layerLayout_ = this.device_.createBindGroupLayout({
      entries: LayerUniformsDef.entries,
    });
  }

  public async compile(name: ShaderName) {
    if (this.shaders_.some((s) => s.name === name)) return;

    const module = this.device_.createShaderModule({
      code: shaderSourceFromName(name),
    });

    const compilationInfo = await module.getCompilationInfo();
    if (compilationInfo.messages.some((m) => m.type === "error")) {
      for (const msg of compilationInfo.messages) {
        Logger.error("WebGPUShaderLibrary", `${msg.type}: ${msg.message}`);
      }
      throw new Error(`Failed to compile WGSL shader ${name}.wgsl`);
    }

    const objectLayout = this.device_.createBindGroupLayout({
      entries: objectDefsFromName(name).entries,
    });

    this.shaders_.push({
      name,
      module,
      bindGroupLayouts: [this.frameLayout_, this.layerLayout_, objectLayout],
    });
  }

  get frameLayout() {
    return this.frameLayout_;
  }

  get layerLayout() {
    return this.layerLayout_;
  }

  public get(name: ShaderName) {
    const cached = this.shaders_.find((s) => s.name === name);
    if (!cached) throw new Error(`Shader "${name}" not compiled`);
    return cached;
  }
}

function shaderSourceFromName(name: ShaderName) {
  switch (name) {
    case "image":
      return shaderImage;
  }
}

function objectDefsFromName(name: ShaderName) {
  switch (name) {
    case "image":
      return ImageObjectDefs;
  }
}
