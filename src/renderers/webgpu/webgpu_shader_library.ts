import shaderBasicPassthrough from "./shaders/basic_passthrough.wgsl";

export default class WebGPUShaderLibrary {
  private readonly device_: GPUDevice;

  constructor(device: GPUDevice) {
    this.device_ = device;
  }
}
