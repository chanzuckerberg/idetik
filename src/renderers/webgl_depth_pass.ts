import { WebGLTextures } from "./webgl_textures";

// DEPTH_COMPONENT24 is stored in a 32-bit texel.
const DEPTH24_BYTES_PER_TEXEL = 4;

/**
 * Off-screen depth-only render target.
 *
 * Owns the framebuffer and the depth texture that layers reading the scene's
 * depth (e.g. {@link VolumeLayer}, which terminates its rays at the nearest
 * opaque surface) sample from. The target is created on first {@link bind} and
 * recreated when the surface is resized.
 *
 * The depth texture lives on a texture unit reserved for the lifetime of the
 * pass, so it stays bound across the draw calls that sample it.
 */
export class WebGLDepthPass {
  private readonly gl_: WebGL2RenderingContext;
  private readonly textureUnit_: number;

  private framebuffer_: WebGLFramebuffer | null = null;
  private texture_: WebGLTexture | null = null;
  private width_ = 0;
  private height_ = 0;

  constructor(gl: WebGL2RenderingContext, textures: WebGLTextures) {
    this.gl_ = gl;
    this.textureUnit_ = textures.reservePersistentUnit();
  }

  /** The unit {@link bindTexture} binds the depth texture to. */
  public get textureUnit() {
    return this.textureUnit_;
  }

  public get textureCount() {
    return this.texture_ ? 1 : 0;
  }

  public get gpuTextureBytes() {
    if (!this.texture_) return 0;
    return this.width_ * this.height_ * DEPTH24_BYTES_PER_TEXEL;
  }

  /**
   * Binds the depth target for writing, creating or resizing it as needed.
   * Callers are responsible for clearing and for the depth state they draw
   * with.
   */
  public bind(width: number, height: number) {
    this.ensureTarget(width, height);
    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, this.framebuffer_);
  }

  /** Restores the default framebuffer. */
  public unbind() {
    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, null);
  }

  /** Binds the depth texture to this pass's reserved unit for sampling. */
  public bindTexture() {
    this.gl_.activeTexture(this.gl_.TEXTURE0 + this.textureUnit_);
    this.gl_.bindTexture(this.gl_.TEXTURE_2D, this.texture_);
  }

  public destroy() {
    if (this.texture_) this.gl_.deleteTexture(this.texture_);
    if (this.framebuffer_) this.gl_.deleteFramebuffer(this.framebuffer_);
    this.texture_ = null;
    this.framebuffer_ = null;
    this.width_ = 0;
    this.height_ = 0;
  }

  private ensureTarget(width: number, height: number) {
    if (this.texture_ && this.width_ === width && this.height_ === height) {
      return;
    }

    const gl = this.gl_;
    if (this.texture_) gl.deleteTexture(this.texture_);
    this.framebuffer_ ??= gl.createFramebuffer();

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.DEPTH_COMPONENT24,
      width,
      height,
      0,
      gl.DEPTH_COMPONENT,
      gl.UNSIGNED_INT,
      null
    );
    // sampled as exact window depth, so no filtering and no wrapping
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer_);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.TEXTURE_2D,
      texture,
      0
    );
    // depth-only: no colour draw or read buffers
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.texture_ = texture;
    this.width_ = width;
    this.height_ = height;
  }
}
