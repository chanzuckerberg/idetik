export type BlendingMode = "none" | "normal" | "additive" | "multiply" | "subtractive";

export class WebGLState {
  private readonly gl_: WebGL2RenderingContext;

  private enabledCapabilities_ = new Map<GLenum, boolean>();
  private depthMaskEnabled_: boolean | null = null;
  private blendSrcFactor_: GLenum | null = null;
  private blendDstFactor_: GLenum | null = null;
  private currentBlendingMode_: BlendingMode | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl_ = gl;
  }

  private enable(cap: GLenum) {
    if (!this.enabledCapabilities_.get(cap)) {
      this.gl_.enable(cap);
      this.enabledCapabilities_.set(cap, true);
    }
  }

  private disable(cap: GLenum) {
    if (this.enabledCapabilities_.get(cap)) {
      this.gl_.disable(cap);
      this.enabledCapabilities_.set(cap, false);
    }
  }

  private setBlendFunc(src: GLenum, dst: GLenum) {
    if (this.blendSrcFactor_ !== src || this.blendDstFactor_ !== dst) {
      this.gl_.blendFunc(src, dst);
      this.blendSrcFactor_ = src;
      this.blendDstFactor_ = dst;
    }
  }

  public setDepthTesting(enabled: boolean) {
    if (enabled) {
      this.enable(this.gl_.DEPTH_TEST);
    } else {
      this.disable(this.gl_.DEPTH_TEST);
    }
  }

  public setBlending(enabled: boolean) {
    if (enabled) {
      this.enable(this.gl_.BLEND);
    } else {
      this.disable(this.gl_.BLEND);
    }
  }

  public setDepthMask(flag: boolean) {
    if (this.depthMaskEnabled_ !== flag) {
      this.gl_.depthMask(flag);
      this.depthMaskEnabled_ = flag;
    }
  }

  public setBlendingMode(mode: BlendingMode) {
    if (this.currentBlendingMode_ === mode) return;

    if (mode === "none") {
      console.log("mode is none");
      this.setBlending(false);
      console.log("blending is disabled");
    } else {
      this.setBlending(true);
      console.log("blending is enabled");
      switch (mode) {
        case "additive":
          console.log("mode is additive");
          this.setBlendFunc(this.gl_.SRC_ALPHA, this.gl_.ONE);
          break;
        case "multiply":
          console.log("mode is multiply");
          this.setBlendFunc(this.gl_.DST_COLOR, this.gl_.ZERO);
          break;
        case "subtractive":
          console.log("mode is subtractive");
          this.setBlendFunc(this.gl_.ZERO, this.gl_.ONE_MINUS_SRC_COLOR);
          break;
        case "normal":
        default:
          console.log("mode is normal");
          this.setBlendFunc(this.gl_.SRC_ALPHA, this.gl_.ONE_MINUS_SRC_ALPHA);
          break;
      }
    }
    this.currentBlendingMode_ = mode;
  }
}
