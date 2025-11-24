import { SliceCoordinates } from "./chunk";

type IsBuffered = (coord: number) => boolean;

type PlaybackDimension = "t" | "z";

export type PlaybackControllerProps = {
  sliceCoords: SliceCoordinates;
  dimension: PlaybackDimension;
  start: number;
  stop: number;
  step: number;
  rateHz?: number;
  bufferSize?: number;
};

export class PlaybackController {
  private readonly sliceCoords_: SliceCoordinates;
  public readonly dimension: PlaybackDimension;
  private readonly start_: number;
  private readonly stop_: number;
  private readonly step_: number;
  private rateHz_: number;
  private lastTimestamp_?: DOMHighResTimeStamp;
  private secondsSinceLastStep_: number = 0;
  private isBuffering_: boolean = false;
  private bufferSize_: number;
  public isBuffered?: IsBuffered;

  constructor(props: PlaybackControllerProps) {
    this.sliceCoords_ = props.sliceCoords;
    this.dimension = props.dimension;
    this.start_ = props.start;
    this.stop_ = props.stop;
    this.step_ = props.step;
    this.rateHz_ = props.rateHz ?? 0;
    this.bufferSize_ = props.bufferSize ?? 0;
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
      this.isBuffering_ = false;
    }
  }

  public get step(): number {
    return this.step_;
  }

  public get isBuffering(): boolean {
    return this.isBuffering_;
  }

  public update(timestamp: DOMHighResTimeStamp): void {
    if (this.rateHz_ === 0) return;

    const coord = this.sliceCoords_[this.dimension];
    if (coord === undefined) return;

    if (this.bufferSize_ > 0) {
      if (!this.isBuffered) {
        this.isBuffering_ = true;
        return;
      }

      // Iterate backwards because it's more likely that later timepoints are missing.
      const to = coord + (this.bufferSize_ - 1) * this.step_;
      for (let c = to; c >= coord; c -= this.step_) {
        if (!this.isBuffered(c)) {
          this.isBuffering_ = true;
          return;
        }
      }
    }

    this.isBuffering_ = false;

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
      const newCoord = coord + this.step_ * stepsToAdvance;
      this.sliceCoords_[this.dimension] =
        newCoord <= this.stop_ ? newCoord : this.start_;
    }
  }
}
