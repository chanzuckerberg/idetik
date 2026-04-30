const DEFAULT_WINDOW_SIZE = 60;

export type FrameTimingStats = {
  /** Last frame's render time in milliseconds */
  frameTimeMs: number;
  /** Rolling average render time in milliseconds */
  averageFrameTimeMs: number;
  /** Frames per second based on rolling average */
  fps: number;
  /** Minimum frame time in the rolling window */
  minFrameTimeMs: number;
  /** Maximum frame time in the rolling window */
  maxFrameTimeMs: number;
  /** Number of frames sampled so far */
  frameCount: number;
};

export class FrameTimer {
  private readonly samples_: Float64Array;
  private readonly windowSize_: number;
  private cursor_ = 0;
  private frameCount_ = 0;
  private lastFrameTimeMs_ = 0;

  constructor(windowSize: number = DEFAULT_WINDOW_SIZE) {
    this.windowSize_ = windowSize;
    this.samples_ = new Float64Array(windowSize);
  }

  public recordFrame(renderTimeMs: number) {
    this.lastFrameTimeMs_ = renderTimeMs;
    this.samples_[this.cursor_] = renderTimeMs;
    this.cursor_ = (this.cursor_ + 1) % this.windowSize_;
    this.frameCount_++;
  }

  public get stats(): FrameTimingStats {
    const count = Math.min(this.frameCount_, this.windowSize_);
    if (count === 0) {
      return {
        frameTimeMs: 0,
        averageFrameTimeMs: 0,
        fps: 0,
        minFrameTimeMs: 0,
        maxFrameTimeMs: 0,
        frameCount: 0,
      };
    }

    let sum = 0;
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < count; i++) {
      const t = this.samples_[i];
      sum += t;
      if (t < min) min = t;
      if (t > max) max = t;
    }

    const avg = sum / count;

    return {
      frameTimeMs: this.lastFrameTimeMs_,
      averageFrameTimeMs: avg,
      fps: avg > 0 ? 1000 / avg : 0,
      minFrameTimeMs: min,
      maxFrameTimeMs: max,
      frameCount: this.frameCount_,
    };
  }

  public reset() {
    this.samples_.fill(0);
    this.cursor_ = 0;
    this.frameCount_ = 0;
    this.lastFrameTimeMs_ = 0;
  }
}
