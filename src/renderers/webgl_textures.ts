import { Texture } from "objects/textures/texture";
import { Texture2D } from "objects/textures/texture_2d";
import { Uint8Texture2D } from "objects/textures/uint8_texture_2d";
import { Uint16Texture2D } from "objects/textures/uint16_texture_2d";

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
      case "Uint8Texture2D":
      case "Uint16Texture2D":
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
      case "Uint8Texture2D":
        this.configuredUint8Texture2D(texture as Uint8Texture2D);
        break;
      case "Uint16Texture2D":
        this.configuredUint16Texture2D(texture as Uint16Texture2D);
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

  private configuredUint8Texture2D(texture: Uint8Texture2D) {
    const gl = this.gl_;
    // Use an unpack alignment of 1 to support any row length of 1-byte
    // uint8 pixel values.
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, texture.rowLength);
    const level = 0;
    const internalFormat = gl.R8UI;
    const border = 0;
    const format = gl.RED_INTEGER;
    const type = gl.UNSIGNED_BYTE;
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
    // Use NEAREST with the R8UI internal format because integer valued textures
    // are not generally texture filterable.
    // https://webgl2fundamentals.org/webgl/lessons/webgl-data-textures.html
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  private configuredUint16Texture2D(texture: Uint16Texture2D) {
    const gl = this.gl_;
    // Use an unpack alignment of 2 to support any row length of 2-byte
    // uint16 pixel values.
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 2);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, texture.rowLength);
    const level = 0;
    const internalFormat = gl.R16UI;
    const border = 0;
    const format = gl.RED_INTEGER;
    const type = gl.UNSIGNED_SHORT;
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
    // Use NEAREST with the R16UI internal format because integer valued textures
    // are not generally texture filterable.
    // https://webgl2fundamentals.org/webgl/lessons/webgl-data-textures.html
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }
}
