export class WebGLState {
  private readonly gl_: WebGL2RenderingContext;

  private capabilities_ = new Map<GLenum, boolean>();
  private depthMaskEnabled_: boolean | null = null;
  private blendSrcFactor_: GLenum | null = null;
  private blendDstFactor_: GLenum | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl_ = gl;
  }

  enable(cap: GLenum) {
    if (!this.capabilities_.get(cap)) {
      this.gl_.enable(cap);
      this.capabilities_.set(cap, true);
    }
  }

  disable(cap: GLenum) {
    if (this.capabilities_.get(cap)) {
      this.gl_.disable(cap);
      this.capabilities_.set(cap, false);
    }
  }

  setDepthMask(flag: boolean) {
    if (this.depthMaskEnabled_ !== flag) {
      this.gl_.depthMask(flag);
      this.depthMaskEnabled_ = flag;
    }
  }

  setBlendFunc(src: GLenum, dst: GLenum) {
    if (this.blendSrcFactor_ !== src || this.blendDstFactor_ !== dst) {
      this.gl_.blendFunc(src, dst);
      this.blendSrcFactor_ = src;
      this.blendDstFactor_ = dst;
    }
  }
}
