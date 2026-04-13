import shaderBasicPassthrough from "./shaders/basic_passthrough.wgsl";

type Shader = "basic_passthrough";

type WebGPUShader = {
  name: Shader;
  module: GPUShaderModule;
  bindGroupLayouts: GPUBindGroupLayout[];
};

export default class WebGPUShaderLibrary {
  private readonly device_: GPUDevice;
  private readonly shaders_: WebGPUShader[];

  constructor(device: GPUDevice) {
    this.device_ = device;
    this.shaders_ = [];
  }

  public async getShader(name: Shader) {
    const cached = this.shaders_.find((s) => s.name === name);
    if (cached) return cached;

    const module = this.device_.createShaderModule({
      code: this.shaderSourceFromName(name),
    });

    const compilationInfo = await module.getCompilationInfo();
    if (compilationInfo.messages.some((m) => m.type === "error")) {
      for (const msg of compilationInfo.messages) {
        console.error(`${msg.type}: ${msg.message}`);
      }
      throw new Error(`Failed to compile WGSL shader ${name}.wgsl`);
    }

    const bindGroupLayouts = this.createBindGroupLayouts();
    const shader: WebGPUShader = { name, module, bindGroupLayouts };

    this.shaders_.push(shader);
    return shader;
  }

  private shaderSourceFromName(name: Shader) {
    switch (name) {
      case "basic_passthrough":
        return shaderBasicPassthrough;
    }
  }

  private createBindGroupLayouts() {
    const frameLayout = this.device_.createBindGroupLayout({
      entries: [
        {
          binding: 0, // projection matrix
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
      ],
    });

    const objectLayout = this.device_.createBindGroupLayout({
      entries: [
        {
          binding: 0, // model-view matrix
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
      ],
    });

    return [frameLayout, objectLayout];
  }
}
