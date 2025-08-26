import { Box2 } from "../math/box2";
import { vec2 } from "gl-matrix";

type XYWH = { x: number; y: number; width: number; height: number };

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
  private currentViewport_: XYWH | null = null;
  private currentScissor_: XYWH | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl_ = gl;
  }

  private static xywhEquals(a: XYWH, b: XYWH): boolean {
    return (
      a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
    );
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

  public setViewport(viewportBox?: Box2) {
    const viewport =
      viewportBox ??
      new Box2(
        vec2.fromValues(0, 0),
        vec2.fromValues(this.gl_.canvas.width, this.gl_.canvas.height)
      );

    const { x, y, width, height } = viewport.asXYWH();
    const flooredXYWH = {
      x: Math.floor(x),
      y: Math.floor(y),
      width: Math.floor(width),
      height: Math.floor(height),
    };

    if (
      this.currentViewport_ &&
      WebGLState.xywhEquals(flooredXYWH, this.currentViewport_)
    ) {
      return;
    }

    this.gl_.viewport(
      flooredXYWH.x,
      flooredXYWH.y,
      flooredXYWH.width,
      flooredXYWH.height
    );
    this.currentViewport_ = flooredXYWH;
  }

  public setScissor(scissorBox?: Box2) {
    const enabled = scissorBox !== undefined;

    if (enabled) {
      const { x, y, width, height } = scissorBox.asXYWH();
      const flooredXYWH: XYWH = {
        x: Math.floor(x),
        y: Math.floor(y),
        width: Math.floor(width),
        height: Math.floor(height),
      };

      if (
        !this.isCapabilityEnabled(this.gl_.SCISSOR_TEST, true)
      ) {
          this.enable(this.gl_.SCISSOR_TEST);
      }

      if(
        this.currentScissor_ &&
        WebGLState.xywhEquals(flooredXYWH, this.currentScissor_)
      ) {
        return;
      }

      this.gl_.scissor(
        flooredXYWH.x,
        flooredXYWH.y,
        flooredXYWH.width,
        flooredXYWH.height
      );
      this.currentScissor_ = flooredXYWH;
    } else {
      if (this.isCapabilityEnabled(this.gl_.SCISSOR_TEST, false)) return;
      this.disable(this.gl_.SCISSOR_TEST);
      this.currentScissor_ = null;
    }
  }
}
