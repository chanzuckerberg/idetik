import {
  type DataAvailability,
  PlaybackController,
  SimplePlaybackController,
} from "./playback_controller";

type SimpleBufferedPlaybackControllerProps = {
  start: number;
  stop: number;
  step: number;
  bufferSize: number;
  value?: number;
  rateHz?: number;
  dataAvailability?: DataAvailability;
};

export class SimpleBufferedPlaybackController implements PlaybackController {
  dataAvailability_?: DataAvailability;
  private controller_: SimplePlaybackController;
  private desiredRateHz_: number;
  private bufferSize_: number;

  constructor(props: SimpleBufferedPlaybackControllerProps) {
    const desiredRateHz = props.rateHz ?? 0;
    this.controller_ = new SimplePlaybackController({
      start: props.start,
      stop: props.stop,
      step: props.step,
      value: props.value,
      rateHz: desiredRateHz,
    });
    this.bufferSize_ = props.bufferSize;
    this.dataAvailability_ = props.dataAvailability;
    this.desiredRateHz_ = desiredRateHz;
  }

  public get rateHz(): number {
    return this.desiredRateHz_;
  }

  public set rateHz(rateHz: number) {
    this.desiredRateHz_ = rateHz;
    if (this.controller_.rateHz > 0) {
      this.controller_.rateHz = rateHz;
    }
  }

  public get value(): number {
    return this.controller_.value;
  }

  public set value(value: number) {
    this.controller_.value = value;
  }

  public get step(): number {
    return this.controller_.step;
  }

  public get isBuffering(): boolean {
    return this.controller_.rateHz === 0 && this.desiredRateHz_ > 0;
  }

  public update(timestamp: DOMHighResTimeStamp): void {
    if (!this.dataAvailability_) return;

    const currentPos = this.controller_.value;
    const loadedAhead = this.dataAvailability_.getLoadedAheadOf(currentPos);

    const isCurrentlyPaused = this.controller_.rateHz === 0;
    const isBuffered = loadedAhead >= this.bufferSize_;
    if (!isCurrentlyPaused && !isBuffered) {
      this.controller_.rateHz = 0;
    } else if (isCurrentlyPaused && isBuffered) {
      this.controller_.rateHz = this.desiredRateHz_;
    }

    this.controller_.update(timestamp);
  }
}
