import { ImageTexture2D } from "./webgl_textures";

export class DownsampledFramebuffer {
  private readonly gl_: WebGL2RenderingContext;
  private framebuffer_: WebGLFramebuffer;
  private texture_: ImageTexture2D;
  private width_: number;
  private height_: number;

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    this.gl_ = gl;
    this.width_ = width;
    this.height_ = height;

    this.framebuffer_ = gl.createFramebuffer();

    this.texture_ = new ImageTexture2D(gl, width, height);
    this.attachTexture();
  }

  public get width() {
    return this.width_;
  }

  public get height() {
    return this.height_;
  }

  public resize(width: number, height: number) {
    if (width === this.width_ && height === this.height_) return;
    if (width <= 0 || height <= 0) return;

    this.texture_.dispose();
    this.texture_ = new ImageTexture2D(this.gl_, width, height);
    this.width_ = width;
    this.height_ = height;
    this.attachTexture();
  }

  public begin() {
    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, this.framebuffer_);
    this.gl_.clearColor(0.0, 0.0, 0.0, 0.0);
    this.gl_.clear(this.gl_.COLOR_BUFFER_BIT);
  }

  public end() {
    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, null);
  }

  public bindTexture() {
    this.gl_.activeTexture(this.gl_.TEXTURE0);
    this.texture_.bind();
  }

  public dispose() {
    this.texture_.dispose();
    this.gl_.deleteFramebuffer(this.framebuffer_);
  }

  private attachTexture() {
    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, this.framebuffer_);
    this.gl_.activeTexture(this.gl_.TEXTURE0);
    this.texture_.bind();
    this.gl_.framebufferTexture2D(
      this.gl_.FRAMEBUFFER,
      this.gl_.COLOR_ATTACHMENT0,
      this.gl_.TEXTURE_2D,
      this.texture_.texture,
      0
    );

    const status = this.gl_.checkFramebufferStatus(this.gl_.FRAMEBUFFER);
    if (status !== this.gl_.FRAMEBUFFER_COMPLETE) {
      throw new Error(
        `DownsampledFramebuffer incomplete: status ${status}`
      );
    }

    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, null);
  }
}
