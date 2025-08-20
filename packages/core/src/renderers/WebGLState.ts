import { Box2 } from "../math/box2";

export type BlendingMode =
  | "none"
  | "normal"
  | "additive"
  | "multiply"
  | "subtractive";

export class WebGLState {
  private readonly gl_: WebGL2RenderingContext;

  private enabledCapabilities_ = new Map<GLenum, boolean>();
  private depthMaskEnabled_: boolean | null = null;
  private blendSrcFactor_: GLenum | null = null;
  private blendDstFactor_: GLenum | null = null;
  private currentBlendingMode_: BlendingMode | null = null;
  private currentViewport_: Box2 | null = null;

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

  private isCapabilityEnabled(cap: GLenum, desired: boolean): boolean {
    return this.enabledCapabilities_.get(cap) === desired;
  }

  public setDepthTesting(enabled: boolean) {
    if (this.isCapabilityEnabled(this.gl_.DEPTH_TEST, enabled)) return;
    if (enabled) {
      this.enable(this.gl_.DEPTH_TEST);
    } else {
      this.disable(this.gl_.DEPTH_TEST);
    }
  }

  public setBlending(enabled: boolean) {
    if (this.isCapabilityEnabled(this.gl_.BLEND, enabled)) return;
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

  public setViewport(box?: Box2) {
    if (box && this.currentViewport_ && Box2.equals(this.currentViewport_, box))
      return;
    this.currentViewport_ = box ? box.clone() : null;
    const { x, y, width, height } = this.getViewportDimensions();
    this.gl_.viewport(x, y, width, height);
  }

  public enableScissor() {
    this.enable(this.gl_.SCISSOR_TEST);
    const { x, y, width, height } = this.getViewportDimensions();
    this.gl_.scissor(x, y, width, height);
  }

  public disableScissor() {
    this.disable(this.gl_.SCISSOR_TEST);
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

  private getViewportDimensions(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    if (!this.currentViewport_) {
      this.currentViewport_ = new Box2(
        [0, 0],
        [this.gl_.canvas.width, this.gl_.canvas.height]
      );
    }
    const box = this.currentViewport_;
    const x = box.min[0];
    const y = box.min[1];
    const width = box.max[0] - box.min[0];
    const height = box.max[1] - box.min[1];
    return { x, y, width, height };
  }
}
