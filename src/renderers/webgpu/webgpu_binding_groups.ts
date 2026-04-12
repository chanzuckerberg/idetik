import WebGPUShaderLibrary from "./webgpu_shader_library";

export default class WebGPUBindingGroups {
  private readonly device_: GPUDevice;
  private readonly shaderLibrary_: WebGPUShaderLibrary;

  constructor(device: GPUDevice, shaderLibrary: WebGPUShaderLibrary) {
    this.device_ = device;
    this.shaderLibrary_ = shaderLibrary;
  }
}
