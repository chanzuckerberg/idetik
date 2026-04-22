const INITIAL_CAPACITY = 16;

export default class WebGPUDynamicBuffer {
  private readonly device_: GPUDevice;
  private readonly alignedSlotSize_: number;
  private readonly staging_: Float32Array<ArrayBuffer>;

  private buffer_: GPUBuffer;
  private capacity_ = INITIAL_CAPACITY;
  private cursor_ = 0;
  private version_ = 0;

  constructor(device: GPUDevice, size: number) {
    this.device_ = device;

    const alignment = this.device_.limits.minUniformBufferOffsetAlignment;

    this.alignedSlotSize_ = Math.ceil(size / alignment) * alignment;
    this.staging_ = new Float32Array(new ArrayBuffer(size));
    this.buffer_ = this.createBuffer();
  }

  public clear() {
    this.cursor_ = 0;
  }

  public write(target: Float32Array) {
    if (this.cursor_ >= this.capacity_) {
      this.resize();
    }

    this.staging_.set(target);
    this.device_.queue.writeBuffer(
      this.buffer_,
      this.cursor_ * this.alignedSlotSize_,
      this.staging_
    );

    this.cursor_++;

    return (this.cursor_ - 1) * this.alignedSlotSize_;
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

    this.version_++;
  }

  private createBuffer() {
    return this.device_.createBuffer({
      size: this.capacity_ * this.alignedSlotSize_,
      usage:
        GPUBufferUsage.UNIFORM |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });
  }
}
