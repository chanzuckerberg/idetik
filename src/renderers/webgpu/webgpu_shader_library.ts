import { Logger } from "@/utilities/logger";

import shaderBasicPassthrough from "./shaders/basic_passthrough.wgsl";

export type ShaderName = "basic_passthrough";

type WebGPUShader = {
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
      entries: [
        {
          binding: 0, // projection matrix
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
      ],
    });

    this.layerLayout_ = this.device_.createBindGroupLayout({
      entries: [
        {
          binding: 0, // opacity
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        }
      ]
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

    const bindGroupLayouts = this.createBindGroupLayouts();

    this.shaders_.push({ name, module, bindGroupLayouts });
  }

  public get(name: ShaderName) {
    const cached = this.shaders_.find((s) => s.name === name);
    if (!cached) throw new Error(`Shader "${name}" not compiled`);
    return cached;
  }

  private createBindGroupLayouts() {
    const objectLayout = this.device_.createBindGroupLayout({
      entries: [
        {
          binding: 0, // model-view matrix
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
      ],
    });

    return [this.frameLayout_, this.layerLayout_, objectLayout];
  }
}

function shaderSourceFromName(name: ShaderName) {
  switch (name) {
    case "basic_passthrough":
      return shaderBasicPassthrough;
  }
}
