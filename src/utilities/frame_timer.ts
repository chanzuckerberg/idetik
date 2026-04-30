const DEFAULT_WINDOW_SIZE = 60;

export type FrameSample = {
  /** Wall-clock time between frames (rAF delta). Includes GPU work + vsync. */
  frameDeltaMs: number;
  /** CPU time spent submitting render commands. */
  renderSubmitMs: number;
  /** GPU execution time. 0 until GPU timestamp queries are implemented. */
  gpuTimeMs: number;
};

export type FrameTimingStats = {
  /** Latest sample */
  current: FrameSample;
  /** Rolling averages over the window */
  average: FrameSample;
  /** Rolling minimums over the window */
  min: FrameSample;
  /** Rolling maximums over the window */
  max: FrameSample;
  /** FPS derived from average frame delta */
  fps: number;
  /** Number of frames sampled so far */
  frameCount: number;
};

const ZERO_SAMPLE: FrameSample = {
  frameDeltaMs: 0,
  renderSubmitMs: 0,
  gpuTimeMs: 0,
};

const KEYS: (keyof FrameSample)[] = [
  "frameDeltaMs",
  "renderSubmitMs",
  "gpuTimeMs",
];

export class FrameTimer {
  private readonly windowSize_: number;
  private readonly samples_: FrameSample[];
  private cursor_ = 0;
  private frameCount_ = 0;
  private current_: FrameSample = { ...ZERO_SAMPLE };

  constructor(windowSize: number = DEFAULT_WINDOW_SIZE) {
    this.windowSize_ = windowSize;
    this.samples_ = [];
  }

  public recordFrame(sample: FrameSample) {
    this.current_ = sample;

    if (this.samples_.length < this.windowSize_) {
      this.samples_.push(sample);
    } else {
      this.samples_[this.cursor_] = sample;
    }

    this.cursor_ = (this.cursor_ + 1) % this.windowSize_;
    this.frameCount_++;
  }

  public get stats(): FrameTimingStats {
    const count = this.samples_.length;
    if (count === 0) {
      return {
        current: { ...ZERO_SAMPLE },
        average: { ...ZERO_SAMPLE },
        min: { ...ZERO_SAMPLE },
        max: { ...ZERO_SAMPLE },
        fps: 0,
        frameCount: 0,
      };
    }

    const avg: FrameSample = { ...ZERO_SAMPLE };
    const min: FrameSample = {
      frameDeltaMs: Infinity,
      renderSubmitMs: Infinity,
      gpuTimeMs: Infinity,
    };
    const max: FrameSample = {
      frameDeltaMs: -Infinity,
      renderSubmitMs: -Infinity,
      gpuTimeMs: -Infinity,
    };

    for (let i = 0; i < count; i++) {
      const s = this.samples_[i];
      for (const k of KEYS) {
        avg[k] += s[k];
        if (s[k] < min[k]) min[k] = s[k];
        if (s[k] > max[k]) max[k] = s[k];
      }
    }

    for (const k of KEYS) {
      avg[k] /= count;
    }

    return {
      current: { ...this.current_ },
      average: avg,
      min,
      max,
      fps: avg.frameDeltaMs > 0 ? 1000 / avg.frameDeltaMs : 0,
      frameCount: this.frameCount_,
    };
  }

  public reset() {
    this.samples_.length = 0;
    this.cursor_ = 0;
    this.frameCount_ = 0;
    this.current_ = { ...ZERO_SAMPLE };
  }
}
