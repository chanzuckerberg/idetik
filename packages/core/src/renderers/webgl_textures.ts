import { Logger } from "../utilities/logger";
import {
  Texture,
  TextureFilter,
  TextureWrapMode,
  TextureDataType,
  TextureDataFormat,
} from "../objects/textures/texture";

import { Texture2D } from "../objects/textures/texture_2d";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import { TextureRgba } from "../objects/textures/texture_rgba";

type TextureFormatInfo = {
  internalFormat: number;
  format: number;
  type: number;
};

export class WebGLTextures {
  private readonly gl_: WebGL2RenderingContext;
  private readonly textures_: Map<Texture, WebGLTexture> = new Map();
  private currentTexture_: Texture | null = null;
  private readonly maxTextureUnits_: number;

  constructor(gl: WebGL2RenderingContext) {
    this.gl_ = gl;
    this.maxTextureUnits_ = gl.MAX_TEXTURE_IMAGE_UNITS;
  }

  public bindTexture(texture: Texture, index: number) {
    if (this.alreadyActive(texture)) return;

    if (index < 0 || index >= this.maxTextureUnits_) {
      throw new Error(
        `Texture index ${index} must be in [0, ${this.maxTextureUnits_ - 1}]`
      );
    }
    this.gl_.activeTexture(this.gl_.TEXTURE0 + index);

    const textureType = this.getTextureType(texture);
    const info = this.getDataFormatInfo(texture.dataFormat, texture.dataType);

    if (!this.textures_.has(texture)) {
      this.generateTexture(texture, info, textureType);
    }

    const textureId = this.textures_.get(texture);
    if (!textureId) {
      throw new Error("Failed to retrieve texture ID");
    }

    this.gl_.bindTexture(textureType, textureId);
    if (texture.needsUpdate && texture.data !== null) {
      this.configureTextureParameters(texture, textureType);
      this.uploadTextureData(texture, info, textureType);
      texture.needsUpdate = false;
    }

    this.currentTexture_ = texture;
  }

  public disposeTexture(texture: Texture) {
    const id = this.textures_.get(texture);
    if (id) {
      this.gl_.deleteTexture(id);
      this.textures_.delete(texture);
      if (this.currentTexture_ === texture) {
        this.currentTexture_ = null;
      }
    }
  }

  public disposeAll() {
    for (const texture of this.textures_.keys()) {
      this.disposeTexture(texture);
    }
  }

  private alreadyActive(texture: Texture) {
    return this.currentTexture_ === texture && !texture.needsUpdate;
  }

  private generateTexture(
    texture: Texture,
    info: TextureFormatInfo,
    type: number
  ) {
    const textureId = this.gl_.createTexture();
    if (!textureId) throw new Error("Failed to create texture");

    this.gl_.bindTexture(type, textureId);

    if (this.isTexture2D(texture)) {
      this.gl_.texStorage2D(
        type,
        texture.mipmapLevels,
        info.internalFormat,
        texture.width,
        texture.height
      );
    } else if (this.isTexture2DArray(texture)) {
      this.gl_.texStorage3D(
        type,
        texture.mipmapLevels,
        info.internalFormat,
        texture.width,
        texture.height,
        texture.depth
      );
    } else {
      throw new Error(`Unknown texture type ${texture.type}`);
    }

    this.textures_.set(texture, textureId);
    this.gl_.bindTexture(type, null);
  }

  private configureTextureParameters(texture: Texture, type: number) {
    const gl = this.gl_;
    const minFilter = this.getFilter(texture.minFilter, texture);
    const maxFilter = this.getFilter(texture.maxFilter, texture);

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, texture.unpackAlignment);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, texture.unpackRowLength);
    gl.texParameteri(type, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(type, gl.TEXTURE_MAG_FILTER, maxFilter);
    gl.texParameteri(type, gl.TEXTURE_WRAP_S, this.getWrapMode(texture.wrapS));
    gl.texParameteri(type, gl.TEXTURE_WRAP_T, this.getWrapMode(texture.wrapT));
    gl.texParameteri(type, gl.TEXTURE_WRAP_R, this.getWrapMode(texture.wrapR));
  }

  private uploadTextureData(
    texture: Texture,
    info: TextureFormatInfo,
    type: number
  ) {
    // Only base level (0) is updated; mipmaps are not supported.
    const mipmapLevel = 0;

    // Zero offsets because entire dataset is overwritten.
    const offset = { x: 0, y: 0, z: 0 };

    if (this.isTexture2D(texture)) {
      this.gl_.texSubImage2D(
        type,
        mipmapLevel,
        offset.x,
        offset.y,
        texture.width,
        texture.height,
        info.format,
        info.type,
        // This function has multiple overloads. We are temporarily casting it to
        // ArrayBufferView to ensure the correct overload is called. Once we
        // consolidate Texture2D and DataTexture2D, we can remove this cast.
        // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texSubImage2D#syntax
        texture.data as ArrayBufferView
      );
    } else if (this.isTexture2DArray(texture)) {
      this.gl_.texSubImage3D(
        type,
        mipmapLevel,
        offset.x,
        offset.y,
        offset.z,
        texture.width,
        texture.height,
        texture.depth,
        info.format,
        info.type,
        texture.data as ArrayBufferView
      );
    } else {
      throw new Error(
        "Attempting to upload data for an unsupported texture type"
      );
    }
  }

  private getFilter(filter: TextureFilter, texture: Texture) {
    const { dataFormat, dataType } = texture;
    if (
      dataFormat === "scalar" &&
      dataType !== "float" &&
      filter !== "nearest"
    ) {
      Logger.warn(
        "WebGLTexture",
        "Integer values are not filterable. Using gl.NEAREST instead."
      );
      return this.gl_.NEAREST;
    }
    // prettier-ignore
    switch (filter) {
      case "nearest": return this.gl_.NEAREST;
      case "linear": return this.gl_.LINEAR;
      default: throw new Error(`Unsupported texture filter: ${filter}`);
    }
  }

  private getTextureType(texture: Texture) {
    if (this.isTexture2D(texture)) return this.gl_.TEXTURE_2D;
    if (this.isTexture2DArray(texture)) return this.gl_.TEXTURE_2D_ARRAY;
    throw new Error(`Unknown texture type ${texture.type}`);
  }

  private getWrapMode(mode: TextureWrapMode) {
    // prettier-ignore
    switch (mode) {
      case "repeat": return this.gl_.REPEAT;
      case "clamp_to_edge": return this.gl_.CLAMP_TO_EDGE;
      default: throw new Error(`Unsupported wrap mode: ${mode}`);
    }
  }

  private getDataFormatInfo(
    format: TextureDataFormat,
    type: TextureDataType
  ): TextureFormatInfo {
    if (format === "rgba" && type === "unsigned_byte") {
      return {
        internalFormat: this.gl_.RGBA8,
        format: this.gl_.RGBA,
        type: this.gl_.UNSIGNED_BYTE,
      };
    }
    if (format === "rgb" && type === "unsigned_byte") {
      return {
        internalFormat: this.gl_.RGB8,
        format: this.gl_.RGB,
        type: this.gl_.UNSIGNED_BYTE,
      };
    }
    if (format === "scalar") {
      switch (type) {
        case "byte":
          return {
            internalFormat: this.gl_.R8I,
            format: this.gl_.RED_INTEGER,
            type: this.gl_.BYTE,
          };
        case "short":
          return {
            internalFormat: this.gl_.R16I,
            format: this.gl_.RED_INTEGER,
            type: this.gl_.SHORT,
          };
        case "int":
          return {
            internalFormat: this.gl_.R32I,
            format: this.gl_.RED_INTEGER,
            type: this.gl_.INT,
          };
        case "unsigned_byte":
          return {
            internalFormat: this.gl_.R8UI,
            format: this.gl_.RED_INTEGER,
            type: this.gl_.UNSIGNED_BYTE,
          };
        case "unsigned_short":
          return {
            internalFormat: this.gl_.R16UI,
            format: this.gl_.RED_INTEGER,
            type: this.gl_.UNSIGNED_SHORT,
          };
        case "unsigned_int":
          return {
            internalFormat: this.gl_.R32UI,
            format: this.gl_.RED_INTEGER,
            type: this.gl_.UNSIGNED_INT,
          };
        case "float":
          return {
            internalFormat: this.gl_.R32F,
            format: this.gl_.RED,
            type: this.gl_.FLOAT,
          };
        default:
          throw new Error(`Unsupported scalar type: ${type}`);
      }
    }
    throw new Error(`Unsupported format/type: ${format}/${type}`);
  }

  private isTexture2D(texture: Texture): texture is Texture2D | TextureRgba {
    return texture.type === "Texture2D" || texture.type === "TextureRgba";
  }

  private isTexture2DArray(texture: Texture): texture is Texture2DArray {
    return texture.type === "Texture2DArray";
  }
}
