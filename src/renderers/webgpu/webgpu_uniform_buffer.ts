const INITIAL_CAPACITY = 16;

export default class WebGPUUniformBuffer {
  private readonly device_: GPUDevice;
  private readonly layout_: GPUBindGroupLayout;
  private readonly alignedSlotSize_: number;
  private readonly staging_: Float32Array<ArrayBuffer>;
  private readonly size_: number;

  private buffer_: GPUBuffer;
  private bindGroup_: GPUBindGroup;
  private capacity_ = INITIAL_CAPACITY;
  private cursor_ = 0;

  constructor(device: GPUDevice, size: number, layout: GPUBindGroupLayout) {
    this.device_ = device;
    this.layout_ = layout;
    this.size_ = size;

    const alignment = this.device_.limits.minUniformBufferOffsetAlignment;

    this.alignedSlotSize_ = Math.ceil(size / alignment) * alignment;
    this.staging_ = new Float32Array(new ArrayBuffer(size));
    this.buffer_ = this.createBuffer();
    this.bindGroup_ = this.createBindGroup();
  }

  public clear() {
    this.cursor_ = 0;
  }

  public write(pack: (target: Float32Array) => void) {
    if (this.cursor_ >= this.capacity_) {
      this.resize();
    }

    pack(this.staging_);
    this.device_.queue.writeBuffer(
      this.buffer_,
      this.cursor_ * this.alignedSlotSize_,
      this.staging_
    );

    const offset = this.cursor_ * this.alignedSlotSize_;
    this.cursor_++;
    return { bindGroup: this.bindGroup_, offset };
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
    this.bindGroup_ = this.createBindGroup();
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

  private createBindGroup() {
    return this.device_.createBindGroup({
      layout: this.layout_,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.buffer_,
            size: this.size_,
          },
        },
      ],
    });
  }
}
