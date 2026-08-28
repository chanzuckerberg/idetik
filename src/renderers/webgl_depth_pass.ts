import { WebGLState } from "./webgl_state";
import { WebGLTextures } from "./webgl_textures";

export class WebGLDepthPass {
  public readonly textureUnit: number;

  private readonly gl_: WebGL2RenderingContext;
  private readonly state_: WebGLState;
  private readonly textures_: WebGLTextures;

  private framebuffer_: WebGLFramebuffer | null = null;
  private texture_: WebGLTexture | null = null;
  private width_ = 0;
  private height_ = 0;

  constructor(
    gl: WebGL2RenderingContext,
    state: WebGLState,
    textures: WebGLTextures
  ) {
    this.gl_ = gl;
    this.state_ = state;
    this.textures_ = textures;
    this.textureUnit = textures.reservePersistentUnit();
  }

  public renderPrePass(draw: () => void) {
    this.state_.setColorMask(false);
    this.state_.setDepthFunc(this.gl_.LESS);
    // nudge the depth away from the camera, so that the color passes
    // at the same depth are not rejected
    this.state_.setPolygonOffset(true);
    draw();
  }

  public renderToTexture(width: number, height: number, draw: () => void) {
    this.bindFBO(width, height);
    this.state_.setDepthMask(true);
    this.state_.setDepthFunc(this.gl_.LESS);
    this.gl_.clear(this.gl_.DEPTH_BUFFER_BIT);
    draw();
    this.unbindFBO();
  }

  private bindFBO(width: number, height: number) {
    this.ensureTarget(width, height);
    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, this.framebuffer_);
  }

  private unbindFBO() {
    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, null);
  }

  public bindTexture() {
    this.textures_.bindTarget(this.texture_, this.textureUnit);
  }

  public destroy() {
    if (this.texture_) this.textures_.disposeTarget(this.texture_);
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
    if (this.texture_) this.textures_.disposeTarget(this.texture_);
    this.framebuffer_ ??= gl.createFramebuffer();

    const texture = this.textures_.createDepthTarget(
      width,
      height,
      this.textureUnit
    );

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
}
