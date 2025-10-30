export type PlaybackControllerProps = {
  start: number;
  stop: number;
  step: number;
  rateHz?: number;
};

export class PlaybackController {
  private readonly start_: number;
  private readonly stop_: number;
  private readonly step_: number;
  private rateHz_: number;
  private currentValue_: number;
  private lastTimestamp_?: DOMHighResTimeStamp;
  private secondsSinceLastStep_: number = 0;

  constructor(props: PlaybackControllerProps) {
    this.start_ = props.start;
    this.stop_ = props.stop;
    this.step_ = props.step;
    this.rateHz_ = props.rateHz ?? 0;
    this.currentValue_ = props.start;
  }

  public get rateHz(): number {
    return this.rateHz_;
  }

  public set rateHz(rateHz: number) {
    if (rateHz < 0) {
      throw new Error(`Rate must be non-negative: ${rateHz}`);
    }
    if (rateHz !== this.rateHz_) {
      this.rateHz_ = rateHz;
      this.secondsSinceLastStep_ = 0;
      this.lastTimestamp_ = undefined;
    }
  }

  public getValue(): number {
    return this.currentValue_;
  }

  public setValue(value: number): void {
    this.currentValue_ = value;
    this.secondsSinceLastStep_ = 0;
    this.lastTimestamp_ = undefined;
  }

  public reset(): void {
    this.setValue(this.start_);
  }

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

    this.secondsSinceLastStep_ += deltaMs / 1000;

    const secondsPerStep = 1 / this.rateHz_;
    const stepsToAdvance = Math.floor(
      this.secondsSinceLastStep_ / secondsPerStep
    );

    if (stepsToAdvance > 0) {
      this.secondsSinceLastStep_ -= stepsToAdvance * secondsPerStep;
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
