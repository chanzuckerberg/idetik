import {
  Texture,
  TextureFilter,
  TextureWrapMode,
  TextureDataType,
  TextureDataFormat,
} from "objects/textures/texture";

export class WebGLTextures {
  private readonly gl_: WebGL2RenderingContext;
  private readonly textures_: Map<string, WebGLTexture> = new Map();
  private currentTexture_: WebGLTexture = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl_ = gl;
  }

  public bind(texture: Texture) {
    if (this.alreadyActive(texture.uuid) && !texture.needsUpdate) return;

    let textureId = this.textures_.get(texture.uuid) || null;
    if (!textureId) {
      textureId = this.createTexture();
    }

    this.gl_.bindTexture(this.getGLTextureType(texture), textureId);
    if (!this.textures_.has(texture.uuid)) {
      this.configureTexture(texture);
      this.textures_.set(texture.uuid, textureId);
    }

    if (texture.needsUpdate && texture.data !== null) {
      // Currently, we don't support mipmaps, so we always update the base level (0).
      const mipmapLevel = 0;
      this.uploadTextureSubData(texture, mipmapLevel, { x: 0, y: 0 });
      texture.needsUpdate = false;
    }

    this.currentTexture_ = textureId;
  }

  private alreadyActive(uuid: string) {
    if (this.currentTexture_ !== 0) {
      return this.textures_.get(uuid) === this.currentTexture_;
    }
    return false;
  }

  private createTexture() {
    const texture = this.gl_.createTexture();
    if (!texture) {
      throw new Error(`Unable to generate a texture name`);
    }
    return texture;
  }

  private configureTexture(texture: Texture) {
    this.configureTextureParameters(texture);
    this.allocateTextureStorage(texture);
  }

  private configureTextureParameters(texture: Texture) {
    const gl = this.gl_;

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, texture.unpackAlignment);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, texture.unpackRowLength);

    gl.texParameteri(
      this.getGLTextureType(texture),
      gl.TEXTURE_MIN_FILTER,
      this.getGLFilter(texture.minFilter, texture.dataFormat)
    );

    gl.texParameteri(
      this.getGLTextureType(texture),
      gl.TEXTURE_MAG_FILTER,
      this.getGLFilter(texture.maxFilter, texture.dataFormat)
    );

    gl.texParameteri(
      this.getGLTextureType(texture),
      gl.TEXTURE_WRAP_S,
      this.getGLWrapMode(texture.wrapS)
    );

    gl.texParameteri(
      this.getGLTextureType(texture),
      gl.TEXTURE_WRAP_T,
      this.getGLWrapMode(texture.wrapT)
    );

    gl.texParameteri(
      this.getGLTextureType(texture),
      gl.TEXTURE_WRAP_R,
      this.getGLWrapMode(texture.wrapR)
    );
  }

  private allocateTextureStorage(texture: Texture) {
    this.gl_.texStorage2D(
      this.getGLTextureType(texture),
      texture.mipmapLevels,
      this.getGLInternalFormat(texture.dataFormat, texture.dataType),
      texture.width,
      texture.height
    );
  }

  private uploadTextureSubData(
    texture: Texture,
    mipmapLevel: number,
    offset: { x: number; y: number }
  ) {
    this.gl_.texSubImage2D(
      this.getGLTextureType(texture),
      mipmapLevel,
      offset.x,
      offset.y,
      texture.width,
      texture.height,
      this.getGLFormat(texture.dataFormat),
      this.getGLType(texture.dataType),
      // This function has multiple overloads. We are temporarily casting it to
      // ArrayBufferView to ensure the correct overload is called. Once we
      // consolidate Texture2D and DataTexture2D, we can remove this cast.
      // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texSubImage2D#syntax
      texture.data as ArrayBufferView
    );
  }

  private getGLTextureType(texture: Texture) {
    switch (texture.type) {
      case "Texture2D":
      case "DataTexture2D":
        return this.gl_.TEXTURE_2D;
      default:
        throw new Error(`Unknown texture type ${texture.type}`);
    }
  }

  private getGLFilter(filter: TextureFilter, format: TextureDataFormat) {
    if (format == "red_integer" && filter != "nearest") {
      console.warn(
        "Integer values are not filterable. Using gl.NEAREST instead."
      );
      return this.gl_.NEAREST;
    }

    switch (filter) {
      case "nearest":
        return this.gl_.NEAREST;
      case "linear":
        return this.gl_.LINEAR;
    }
  }

  private getGLWrapMode(mode: TextureWrapMode) {
    switch (mode) {
      case "repeat":
        return this.gl_.REPEAT;
      case "clamp_to_edge":
        return this.gl_.CLAMP_TO_EDGE;
    }
  }

  private getGLType(type: TextureDataType) {
    switch (type) {
      case "unsigned_byte":
        return this.gl_.UNSIGNED_BYTE;
      case "unsigned_short":
        return this.gl_.UNSIGNED_SHORT;
    }
  }

  private getGLFormat(type: TextureDataFormat) {
    switch (type) {
      case "rgb":
        return this.gl_.RGB;
      case "rgba":
        return this.gl_.RGBA;
      case "red_integer":
        return this.gl_.RED_INTEGER;
    }
  }

  private getGLInternalFormat(
    format: TextureDataFormat,
    type: TextureDataType
  ) {
    if (format === "rgba" && type === "unsigned_byte") {
      return this.gl_.RGBA8;
    } else if (format === "rgb" && type === "unsigned_byte") {
      return this.gl_.RGB8;
    } else if (format === "red_integer" && type === "unsigned_byte") {
      return this.gl_.R8UI;
    } else if (format === "red_integer" && type === "unsigned_short") {
      return this.gl_.R16UI;
    }
    throw Error(
      `Unsupported data format and type combination ${format}/${type}`
    );
  }
}
