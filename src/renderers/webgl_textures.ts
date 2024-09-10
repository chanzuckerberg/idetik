import { Texture } from "objects/textures/texture";
import { Texture2D } from "@/objects/textures/texture_2d";

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
        return this.gl_.TEXTURE_2D;
      default:
        throw new Error(`Unknown texture type`);
    }
  }

  private configureTexture(texture: Texture) {
    switch (texture.type) {
      case "Texture2D":
        this.configuredTexture2D(texture as Texture2D);
        break;
      default:
        throw new Error(`Unknown texture type`);
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
}
