export type PlaybackControllerProps = {
  start: number;
  stop: number;
  step: number;
  rateHz?: number;
};

/**
 * Controls playback of a time-varying parameter using requestAnimationFrame timestamps.
 * The controller advances the current value based on elapsed time and the specified rate.
 */
export class PlaybackController {
  private readonly start_: number;
  private readonly stop_: number;
  private readonly step_: number;
  private rateHz_: number;
  private currentValue_: number;
  private lastTimestamp_?: DOMHighResTimeStamp;
  private accumulatedTime_: number = 0;

  constructor(props: PlaybackControllerProps) {
    this.start_ = props.start;
    this.stop_ = props.stop;
    this.step_ = props.step;
    this.rateHz_ = props.rateHz ?? 0;
    this.currentValue_ = props.start;
  }

  /**
   * Gets the current playback rate in Hz (steps per second).
   */
  public get rateHz(): number {
    return this.rateHz_;
  }

  /**
   * Sets the playback rate in Hz (steps per second).
   * A rate of 0 pauses playback.
   */
  public set rateHz(rateHz: number) {
    if (rateHz < 0) {
      throw new Error(`Rate must be non-negative: ${rateHz}`);
    }
    if (rateHz !== this.rateHz_) {
      this.rateHz_ = rateHz;
      this.accumulatedTime_ = 0;
      this.lastTimestamp_ = undefined;
    }
  }

  /**
   * Gets the current value.
   */
  public getValue(): number {
    return this.currentValue_;
  }

  /**
   * Sets the current value.
   */
  public setValue(value: number): void {
    this.currentValue_ = value;
    this.accumulatedTime_ = 0;
    this.lastTimestamp_ = undefined;
  }

  /**
   * Resets playback to the start value.
   */
  public reset(): void {
    this.setValue(this.start_);
  }

  /**
   * Updates the playback state based on the current timestamp.
   * Should be called once per frame from the animation loop.
   */
  public update(timestamp: DOMHighResTimeStamp): void {
    if (this.rateHz_ === 0) {
      this.lastTimestamp_ = undefined;
      return;
    }

    if (this.lastTimestamp_ === undefined) {
      this.lastTimestamp_ = timestamp;
      return;
    }

    const deltaMs = timestamp - this.lastTimestamp_;
    this.lastTimestamp_ = timestamp;

    // Accumulate time in seconds
    this.accumulatedTime_ += deltaMs / 1000;

    // Calculate how many steps we should advance based on rate
    const timePerStep = 1 / this.rateHz_;
    const stepsToAdvance = Math.floor(this.accumulatedTime_ / timePerStep);

    if (stepsToAdvance > 0) {
      this.accumulatedTime_ -= stepsToAdvance * timePerStep;
      this.advanceSteps(stepsToAdvance);
    }
  }

  private advanceSteps(count: number): void {
    for (let i = 0; i < count; i++) {
      const newValue = this.currentValue_ + this.step_;
      if (newValue <= this.stop_) {
        this.currentValue_ = newValue;
      } else {
        // Wrap around to start
        this.currentValue_ = this.start_;
      }
    }
  }
}
