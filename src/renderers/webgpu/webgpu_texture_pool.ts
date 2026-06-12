import {
  Texture,
  textureBytesPerChannel,
  textureChannelCount,
} from "@/objects/textures/texture";
import { Texture3D } from "@/objects/textures/texture_3d";

type WebGPUTexture = {
  entry: Texture;
  texture: GPUTexture;
};

export default class WebGPUTexturePool {
  private readonly device_: GPUDevice;
  private readonly textures_: WebGPUTexture[];

  constructor(device: GPUDevice) {
    this.device_ = device;
    this.textures_ = [];
  }

  public get(entry: Texture) {
    const cached = this.textures_.find((t) => t.entry === entry);
    if (cached) {
      if (entry.needsUpdate) {
        this.upload(entry, cached.texture);
      }
      return cached.texture;
    }

    const texture = this.device_.createTexture({
      size: textureSize(entry),
      dimension: entry instanceof Texture3D ? "3d" : "2d",
      format: textureGPUFormat(entry),
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    this.upload(entry, texture);
    this.textures_.push({ entry: entry, texture: texture });

    return texture;
  }

  private upload(entry: Texture, texture: GPUTexture) {
    const channelCount = textureChannelCount(entry);
    const bytesPerChannel = textureBytesPerChannel(entry);
    const bytesPerRow = entry.width * channelCount * bytesPerChannel;

    this.device_.queue.writeTexture(
      { texture: texture },
      entry.data as BufferSource,
      { bytesPerRow, rowsPerImage: entry.height },
      textureSize(entry)
    );

    entry.needsUpdate = false;
  }

  public dispose(texture: Texture) {
    const index = this.textures_.findIndex((t) => t.entry === texture);
    if (index === -1) return;

    this.textures_[index].texture.destroy();
    this.textures_.splice(index, 1);
  }

  public disposeAll() {
    for (const t of this.textures_) t.texture.destroy();
    this.textures_.length = 0;
  }
}

function textureSize(texture: Texture): GPUExtent3DStrict {
  return {
    width: texture.width,
    height: texture.height,
    depthOrArrayLayers: texture instanceof Texture3D ? texture.depth : 1,
  };
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
