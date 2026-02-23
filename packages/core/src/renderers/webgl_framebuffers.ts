import { ImageTexture2D } from "./webgl_textures";

export class TransparencyBuffer {
  private readonly gl_: WebGL2RenderingContext;
  private framebuffer_: WebGLFramebuffer;
  private buffers_: number[];
  public textures: ImageTexture2D[] = [];

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    this.gl_ = gl;

    this.framebuffer_ = this.gl_.createFramebuffer();
    const ext = this.gl_.getExtension("EXT_color_buffer_float");
    if (!ext) {
      throw new Error(
        "EXT_color_buffer_float extension is not supported by the browser and required for transparency buffer setup"
      );
    }
    this.buffers_ = [this.gl_.COLOR_ATTACHMENT0, this.gl_.COLOR_ATTACHMENT1];
    this.resize(width, height);
  }

  bindTextures() {
    this.gl_.activeTexture(this.gl_.TEXTURE0);
    this.textures[0].bind();
    this.gl_.activeTexture(this.gl_.TEXTURE1);
    this.textures[1].bind();
  }

  resize(width: number, height: number) {
    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, this.framebuffer_);

    const texture0 = new ImageTexture2D(this.gl_, width, height);
    this.gl_.activeTexture(this.gl_.TEXTURE0);
    texture0.bind();
    this.gl_.framebufferTexture2D(
      this.gl_.FRAMEBUFFER,
      this.gl_.COLOR_ATTACHMENT0,
      this.gl_.TEXTURE_2D,
      texture0.texture,
      0
    );

    const texture1 = new ImageTexture2D(this.gl_, width, height, "r");
    this.gl_.activeTexture(this.gl_.TEXTURE1);
    texture1.bind();
    this.gl_.framebufferTexture2D(
      this.gl_.FRAMEBUFFER,
      this.gl_.COLOR_ATTACHMENT1,
      this.gl_.TEXTURE_2D,
      texture1.texture,
      0
    );

    this.textures = [texture0, texture1];

    const status = this.gl_.checkFramebufferStatus(this.gl_.FRAMEBUFFER);
    if (status !== this.gl_.FRAMEBUFFER_COMPLETE) {
      throw new Error(
        `Failed to create transparency framebuffer: status ${status}`
      );
    }

    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, null);
  }

  begin() {
    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, this.framebuffer_);
    this.gl_.drawBuffers(this.buffers_);
    this.gl_.blendFuncSeparate(
      WebGL2RenderingContext.ONE,
      WebGL2RenderingContext.ONE,
      WebGL2RenderingContext.ZERO,
      WebGL2RenderingContext.ONE_MINUS_SRC_ALPHA
    );
    this.clear();
    this.gl_.enable(this.gl_.BLEND);
  }

  end() {
    // In theory this should reset the render state touched in begin
    // TODO implement that by looking into the state class for webgl
    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, null);
  }

  clear() {
    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, this.framebuffer_);
    this.gl_.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl_.clear(this.gl_.COLOR_BUFFER_BIT);
  }

  dispose() {
    this.gl_.deleteFramebuffer(this.framebuffer_);
    for (const texture of this.textures) {
      this.gl_.deleteTexture(texture.texture);
    }
  }
}
