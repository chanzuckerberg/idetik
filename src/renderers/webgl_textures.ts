import { Texture } from "objects/textures/texture";
import { Texture2D } from "objects/textures/texture_2d";
import { DataTexture2D } from "@/objects/textures/data_texture_2d";

export class WebGLTextures {
  private readonly gl_: WebGL2RenderingContext;
  private textures_: Map<string, WebGLTexture> = new Map();
  private currentTexture_: WebGLTexture = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl_ = gl;
  }

  public bind(texture: Texture) {
    if (this.alreadyActive(texture.uuid)) return;

    let textureId = this.textures_.get(texture.uuid) || null;
    if (!textureId) {
      textureId = this.createTexture();
    }

    this.gl_.bindTexture(this.textureType(texture), textureId);
    if (!this.textures_.has(texture.uuid)) {
      this.configureTexture(texture);
      this.textures_.set(texture.uuid, textureId);
    }

    this.currentTexture_ = textureId;
  }

  private alreadyActive(uuid: string) {
    if (this.currentTexture_ !== 0) {
      return this.textures_.get(uuid) === this.currentTexture_;
    }
    return false;
  }

  private textureType(texture: Texture) {
    switch (texture.type) {
      case "Texture2D":
      case "DataTexture2D":
        return this.gl_.TEXTURE_2D;
      default:
        throw new Error(`Unknown texture type ${texture.type}`);
    }
  }

  private configureTexture(texture: Texture) {
    switch (texture.type) {
      case "Texture2D":
        this.configuredTexture2D(texture as Texture2D);
        break;
      case "DataTexture2D":
        this.configuredDataTexture2D(texture as DataTexture2D);
        break;
      default:
        throw new Error(`Unknown texture type ${texture.type}`);
    }
  }

  private createTexture() {
    const texture = this.gl_.createTexture();
    if (!texture) {
      throw new Error(`Unable to generate a texture name`);
    }
    return texture;
  }

  private configuredTexture2D(texture: Texture2D) {
    const gl = this.gl_;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;
    const image = texture.image;

    gl.texImage2D(gl.TEXTURE_2D, 0, format, format, type, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  private configuredDataTexture2D(texture: DataTexture2D) {
    const gl = this.gl_;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, texture.unpackAlignment);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, texture.rowLength);
    const level = 0;
    const internalFormat = this.dataTexture2DGlInternalFormat(texture);
    const border = 0;
    const format = gl.RED_INTEGER;
    const type = this.dataTexture2DGlType(texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      internalFormat,
      texture.width,
      texture.height,
      border,
      format,
      type,
      texture.data
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Use NEAREST because integer and float valued textures are not generally
    // texture filterable.
    // https://webgl2fundamentals.org/webgl/lessons/webgl-data-textures.html
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  private dataTexture2DGlInternalFormat(texture: DataTexture2D): number {
    const gl = this.gl_;
    switch (texture.dataType) {
      case "Uint8Array":
        return gl.R8UI;
      case "Uint16Array":
        return gl.R16UI;
    }
    throw Error(`Unsupported data type: ${texture.dataType}`);
  }

  private dataTexture2DGlType(texture: DataTexture2D): number {
    const gl = this.gl_;
    switch (texture.dataType) {
      case "Uint8Array":
        return gl.UNSIGNED_BYTE;
      case "Uint16Array":
        return gl.UNSIGNED_SHORT;
    }
    throw Error(`Unsupported data type: ${texture.dataType}`);
  }
}
