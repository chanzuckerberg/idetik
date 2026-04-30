import {
  Texture,
  textureBytesPerChannel,
  textureChannelCount,
} from "@/objects/textures/texture";
import { Texture3D } from "@/objects/textures/texture_3d";

type WebGPUTexture = {
  texture: Texture;
  buffer: GPUTexture;
};

export default class WebGPUTexturePool {
  private readonly device_: GPUDevice;
  private readonly textures_: WebGPUTexture[];
  private dummy3D_: GPUTexture | null = null;

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

    const buffer = this.create(texture);
    this.upload(texture, buffer);
    this.textures_.push({ texture, buffer });

    return buffer;
  }

  public dummy3D() {
    if (!this.dummy3D_) {
      this.dummy3D_ = this.device_.createTexture({
        size: { width: 1, height: 1, depthOrArrayLayers: 1 },
        dimension: "3d",
        format: "r32uint",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });
      this.device_.queue.writeTexture(
        { texture: this.dummy3D_ },
        new Uint32Array([0]),
        { bytesPerRow: 4, rowsPerImage: 1 },
        { width: 1, height: 1, depthOrArrayLayers: 1 }
      );
    }
    return this.dummy3D_;
  }

  public dispose(texture: Texture): GPUTexture | null {
    const index = this.textures_.findIndex((t) => t.texture === texture);
    if (index === -1) return null;

    const buffer = this.textures_[index].buffer;
    buffer.destroy();
    this.textures_.splice(index, 1);
    return buffer;
  }

  public disposeAll() {
    for (const t of this.textures_) t.buffer.destroy();
    this.textures_.length = 0;
    if (this.dummy3D_) {
      this.dummy3D_.destroy();
      this.dummy3D_ = null;
    }
  }

  private create(texture: Texture): GPUTexture {
    if (texture instanceof Texture3D) {
      return this.device_.createTexture({
        size: {
          width: texture.width,
          height: texture.height,
          depthOrArrayLayers: texture.depth,
        },
        dimension: "3d",
        format: textureGPUFormat(texture),
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });
    }

    return this.device_.createTexture({
      size: { width: texture.width, height: texture.height },
      format: textureGPUFormat(texture),
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
  }

  private upload(texture: Texture, buffer: GPUTexture) {
    const channelCount = textureChannelCount(texture);
    const bytesPerChannel = textureBytesPerChannel(texture);
    const bytesPerRow = texture.width * channelCount * bytesPerChannel;

    if (texture instanceof Texture3D) {
      this.device_.queue.writeTexture(
        { texture: buffer },
        texture.data as BufferSource,
        { bytesPerRow, rowsPerImage: texture.height },
        {
          width: texture.width,
          height: texture.height,
          depthOrArrayLayers: texture.depth,
        }
      );
    } else {
      this.device_.queue.writeTexture(
        { texture: buffer },
        texture.data as BufferSource,
        { bytesPerRow },
        { width: texture.width, height: texture.height }
      );
    }

    texture.needsUpdate = false;
  }
}

export function textureGPUFormat(texture: Texture): GPUTextureFormat {
  if (texture.dataFormat === "rgb") {
    throw new Error("RGB texture format is not supported in WebGPU");
  }

  // 3D textures are only used by the volume renderer, which expects uint
  // formats matching its `texture_3d<u32>` shader binding.
  if (texture instanceof Texture3D) {
    switch (texture.dataType) {
      case "unsigned_byte":
        return "r8uint";
      case "unsigned_short":
        return "r16uint";
      case "unsigned_int":
        return "r32uint";
      default:
        throw new Error(
          `3D textures are only supported with unsigned data types (got ${texture.dataType})`
        );
    }
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
