import { SliceCoordinates } from "./chunk";

type GetNumBuffered = (coord: number) => number;

type PlaybackDimension = "t" | "z";

export type PlaybackControllerProps = {
  sliceCoords: SliceCoordinates;
  dimension: PlaybackDimension;
  start: number;
  stop: number;
  step: number;
  rateHz?: number;
  requiredBufferLength?: number;
  numBufferedRequired?: number;
};

export class PlaybackController {
  private readonly sliceCoords_: SliceCoordinates;
  private readonly dimension_: PlaybackDimension;
  private readonly start_: number;
  private readonly stop_: number;
  private readonly step_: number;
  private rateHz_: number;
  private lastTimestamp_?: DOMHighResTimeStamp;
  private secondsSinceLastStep_: number = 0;
  private isBuffering_: boolean = true;
  private requiredBufferLength_: number;

  public getNumBuffered?: GetNumBuffered;

  constructor(props: PlaybackControllerProps) {
    this.sliceCoords_ = props.sliceCoords;
    this.dimension_ = props.dimension;
    this.start_ = props.start;
    this.stop_ = props.stop;
    this.step_ = props.step;
    this.rateHz_ = props.rateHz ?? 0;
    this.requiredBufferLength_ = props.requiredBufferLength ?? 0;
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

  public get step(): number {
    return this.step_;
  }

  public get isBuffering(): boolean {
    return this.isBuffering_;
  }

  public update(timestamp: DOMHighResTimeStamp): void {
    if (this.rateHz_ === 0) return;

    const coord = this.sliceCoords_[this.dimension_];
    if (coord === undefined) return;

    if (this.requiredBufferLength_ > 0) {
      if (!this.getNumBuffered) {
        this.isBuffering_ = true;
        return;
      }
      const numBuffered = this.getNumBuffered(coord);
      if (this.requiredBufferLength_ > numBuffered) {
        this.isBuffering_ = true;
        return;
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
      this.sliceCoords_[this.dimension_] =
        newCoord <= this.stop_ ? newCoord : this.start_;
    }
  }
}
