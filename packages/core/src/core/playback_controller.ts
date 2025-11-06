export interface DataAvailability {
  isLoaded(index: number): boolean;
  getLoadedAheadOf(position: number): number;
}
export interface PlaybackController {
  rateHz: number;
  value: number;
  readonly step: number;
  update(timestamp: DOMHighResTimeStamp): void;
  dataAvailability_?: DataAvailability;
}

export type SimplePlaybackControllerProps = {
  start: number;
  stop: number;
  step: number;
  rateHz?: number;
};

export class SimplePlaybackController implements PlaybackController {
  private readonly start_: number;
  private readonly stop_: number;
  private readonly step_: number;
  private rateHz_: number;
  private value_: number;
  private lastTimestamp_?: DOMHighResTimeStamp;
  private secondsSinceLastStep_: number = 0;

  constructor(props: SimplePlaybackControllerProps) {
    this.start_ = props.start;
    this.stop_ = props.stop;
    this.step_ = props.step;
    this.rateHz_ = props.rateHz ?? 0;
    this.value_ = props.start;
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

  public get value(): number {
    return this.value_;
  }

  public set value(value: number) {
    this.value_ = value;
    this.secondsSinceLastStep_ = 0;
    this.lastTimestamp_ = undefined;
  }

  public get step(): number {
    return this.step_;
  }

  public update(timestamp: DOMHighResTimeStamp): void {
    if (this.rateHz_ === 0) return;

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
    const newValue = this.value_ + this.step_ * count;
    if (newValue <= this.stop_) {
      this.value_ = newValue;
    } else {
      this.value_ = this.start_;
    }
  }
}
