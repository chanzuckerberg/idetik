import { Box2 } from "../math/box2";

export type BlendingMode =
  | "none"
  | "normal"
  | "additive"
  | "multiply"
  | "subtractive";

export type CullingMode = "none" | "front" | "back" | "both";

export class WebGLState {
  private readonly gl_: WebGL2RenderingContext;

  private enabledCapabilities_ = new Map<GLenum, boolean>();
  private depthMaskEnabled_: boolean | null = null;
  private blendSrcFactor_: GLenum | null = null;
  private blendDstFactor_: GLenum | null = null;
  private currentBlendingMode_: BlendingMode | null = null;
  private currentViewport_: Box2 | null = null;
  private currentScissor_: Box2 | null = null;
  private currentCullingMode_: CullingMode | null = null;

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
      this.setBlending(false);
    } else {
      this.setBlending(true);
      switch (mode) {
        case "additive":
          this.setBlendFunc(this.gl_.SRC_ALPHA, this.gl_.ONE);
          break;
        case "multiply":
          this.setBlendFunc(this.gl_.DST_COLOR, this.gl_.ZERO);
          break;
        case "subtractive":
          this.setBlendFunc(this.gl_.ZERO, this.gl_.ONE_MINUS_SRC_COLOR);
          break;
        case "normal":
        default:
          this.setBlendFunc(this.gl_.SRC_ALPHA, this.gl_.ONE_MINUS_SRC_ALPHA);
          break;
      }
    }
    this.currentBlendingMode_ = mode;
  }

  public setViewport(box: Box2) {
    const clampedBox = box.floor();

    if (
      this.currentViewport_ &&
      Box2.equals(clampedBox, this.currentViewport_)
    ) {
      return;
    }
    const { x, y, width, height } = clampedBox.toRect();
    this.gl_.viewport(x, y, width, height);
    this.currentViewport_ = clampedBox;
  }

  public setScissorTest(enabled: boolean) {
    if (enabled) {
      this.enable(this.gl_.SCISSOR_TEST);
    } else {
      this.disable(this.gl_.SCISSOR_TEST);
      this.currentScissor_ = null;
    }
  }

  public setScissor(box: Box2) {
    const clampedBox = box.floor();

    if (this.currentScissor_ && Box2.equals(clampedBox, this.currentScissor_)) {
      return;
    }
    const { x, y, width, height } = clampedBox.toRect();
    this.gl_.scissor(x, y, width, height);
    this.currentScissor_ = clampedBox;
  }

  public setCullFace(enabled: boolean) {
    if (enabled) {
      this.enable(this.gl_.CULL_FACE);
    } else {
      this.disable(this.gl_.CULL_FACE);
    }
  }

  public setCullFaceMode(mode: CullingMode) {
    if (this.currentCullingMode_ === mode) return;

    if (mode === "none") {
      this.setCullFace(false);
    } else {
      this.setCullFace(true);
      switch (mode) {
        case "front":
          this.gl_.cullFace(this.gl_.FRONT);
          break;
        case "back":
          this.gl_.cullFace(this.gl_.BACK);
          break;
        case "both":
          this.gl_.cullFace(this.gl_.FRONT_AND_BACK);
          break;
      }
    }

    this.currentCullingMode_ = mode;
  }

  public setStencilTest(enabled: boolean) {
    if (enabled) {
      this.enable(this.gl_.STENCIL_TEST);
    } else {
      this.disable(this.gl_.STENCIL_TEST);
    }
  }
}
