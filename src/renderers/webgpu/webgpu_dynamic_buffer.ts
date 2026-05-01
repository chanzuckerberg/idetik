const INITIAL_CAPACITY = 16;

export default class WebGPUDynamicBuffer {
  private readonly device_: GPUDevice;
  private readonly slotSize_: number;

  private buffer_: GPUBuffer;
  private capacity_ = INITIAL_CAPACITY;
  private cursor_ = 0;
  private version_ = 0;

  constructor(device: GPUDevice, perObjectDataSize: number) {
    const minAlignment = device.limits.minUniformBufferOffsetAlignment;

    this.device_ = device;
    this.slotSize_ = Math.ceil(perObjectDataSize / minAlignment) * minAlignment;
    this.buffer_ = this.createBuffer();
  }

  public clear() {
    this.cursor_ = 0;
  }

  public write(target: Float32Array<ArrayBuffer>) {
    if (this.cursor_ >= this.capacity_) {
      this.resize();
    }

    this.device_.queue.writeBuffer(
      this.buffer_,
      this.cursor_ * this.slotSize_,
      target
    );

    this.cursor_++;

    return (this.cursor_ - 1) * this.slotSize_;
  }

  public get buffer() {
    return this.buffer_;
  }

  public get version() {
    return this.version_;
  }

  private resize() {
    const prevBuffer = this.buffer_;

    this.capacity_ *= 2;
    this.buffer_ = this.createBuffer();

    const commandEncoder = this.device_.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(
      prevBuffer,
      0,
      this.buffer_,
      0,
      prevBuffer.size
    );
    this.device_.queue.submit([commandEncoder.finish()]);

    prevBuffer.destroy();

    this.version_++;
  }

  private createBuffer() {
    return this.device_.createBuffer({
      size: this.capacity_ * this.slotSize_,
      usage:
        GPUBufferUsage.UNIFORM |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });
  }
}
