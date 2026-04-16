import {
  Texture,
  textureBytesPerChannel,
  textureChannelCount,
} from "@/objects/textures/texture";

type WebGPUTexture = {
  texture: Texture;
  buffer: GPUTexture;
};

export default class WebGPUTexturePool {
  private readonly device_: GPUDevice;
  private readonly textures_: WebGPUTexture[];

  constructor(device: GPUDevice) {
    this.device_ = device;
    this.textures_ = [];
  }

  public get(texture: Texture) {
    const cached = this.textures_.find((t) => t.texture === texture);
    if (cached) {
      if (texture.needsUpdate) {
        this.upload(texture, cached.buffer);
      }
      return cached.buffer;
    }

    const size = { width: texture.width, height: texture.height };
    const buffer = this.device_.createTexture({
      size,
      format: textureGPUFormat(texture),
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    this.upload(texture, buffer);
    this.textures_.push({ texture, buffer });

    return buffer;
  }

  private upload(texture: Texture, buffer: GPUTexture) {
    const size = { width: texture.width, height: texture.height };
    const channelCount = textureChannelCount(texture);
    const bytesPerChannel = textureBytesPerChannel(texture);
    const bytesPerRow = texture.width * channelCount * bytesPerChannel;

    this.device_.queue.writeTexture(
      { texture: buffer },
      texture.data as BufferSource,
      { bytesPerRow },
      size
    );

    texture.needsUpdate = false;
  }
}

export function textureGPUFormat(texture: Texture): GPUTextureFormat {
  if (texture.dataFormat === "rgb") {
    throw new Error("RGB texture format is not supported in WebGPU");
  }

  if (texture.dataFormat === "scalar") {
    switch (texture.dataType) {
      case "byte":
        return "r8snorm";
      case "unsigned_byte":
        return "r8unorm";
      case "short":
        return "r16sint";
      case "unsigned_short":
        return "r16uint";
      case "int":
        return "r32sint";
      case "unsigned_int":
        return "r32uint";
      case "float":
        return "r32float";
    }
  }

  switch (texture.dataType) {
    case "byte":
      return "rgba8snorm";
    case "unsigned_byte":
      return "rgba8unorm";
    case "short":
      return "rgba16sint";
    case "unsigned_short":
      return "rgba16uint";
    case "int":
      return "rgba32sint";
    case "unsigned_int":
      return "rgba32uint";
    case "float":
      return "rgba32float";
  }
}
