export class WebGLDepthTarget {
  public readonly textureUnit: number;

  private readonly gl_: WebGL2RenderingContext;

  private framebuffer_: WebGLFramebuffer | null = null;
  private texture_: WebGLTexture | null = null;
  private width_ = 0;
  private height_ = 0;

  constructor(gl: WebGL2RenderingContext, textureUnit: number) {
    this.gl_ = gl;
    this.textureUnit = textureUnit;
  }

  public bind(width: number, height: number) {
    if (!this.hasValidTarget(width, height)) {
      this.createRenderTarget(width, height);
    }
    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, this.framebuffer_);
  }

  public unbind() {
    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, null);
  }

  public dispose() {
    if (this.texture_) this.gl_.deleteTexture(this.texture_);
    if (this.framebuffer_) this.gl_.deleteFramebuffer(this.framebuffer_);
    this.texture_ = null;
    this.framebuffer_ = null;
    this.width_ = 0;
    this.height_ = 0;
  }

  private hasValidTarget(width: number, height: number) {
    return (
      this.texture_ !== null && this.width_ === width && this.height_ === height
    );
  }

  private createRenderTarget(width: number, height: number) {
    const gl = this.gl_;
    if (this.texture_) gl.deleteTexture(this.texture_);
    this.framebuffer_ ??= gl.createFramebuffer();

    const texture = this.createDepthTexture(width, height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer_);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.TEXTURE_2D,
      texture,
      0
    );
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.texture_ = texture;
    this.width_ = width;
    this.height_ = height;
  }

  private createDepthTexture(width: number, height: number) {
    const gl = this.gl_;
    const texture = gl.createTexture();
    if (!texture) throw new Error("Failed to create scene depth texture");

    gl.activeTexture(gl.TEXTURE0 + this.textureUnit);
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

    return texture;
  }
}
