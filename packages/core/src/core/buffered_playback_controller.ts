import { Logger } from "@/utilities/logger";
import {
  type DataAvailability,
  PlaybackController,
  SimplePlaybackController,
} from "./playback_controller";

type BufferedPlaybackControllerProps = {
  start: number;
  stop: number;
  step: number;
  value?: number;
  rateHz?: number;
  dataAvailability?: DataAvailability;
  minBufferSeconds?: number;
  resumeBufferSeconds?: number;
  loadingWindowMs?: number;
};

export class BufferedPlaybackController implements PlaybackController {
  dataAvailability_?: DataAvailability;
  private controller_: SimplePlaybackController;
  private loadingStats_: LoadingStatistics;
  private strategy_: AdaptiveBufferStrategy;
  private desiredRateHz_: number;

  constructor(props: BufferedPlaybackControllerProps) {
    const desiredRateHz = props.rateHz ?? 0;
    this.controller_ = new SimplePlaybackController({
      start: props.start,
      stop: props.stop,
      step: props.step,
      value: props.value,
      rateHz: desiredRateHz,
    });
    this.dataAvailability_ = props.dataAvailability;
    this.desiredRateHz_ = desiredRateHz;
    this.loadingStats_ = new LoadingStatistics(props.loadingWindowMs);
    this.strategy_ = new AdaptiveBufferStrategy(
      props.minBufferSeconds,
      props.resumeBufferSeconds
    );
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

    this.loadingStats_.recordLoadState(timestamp, currentPos + loadedAhead);

    const loadRate = this.loadingStats_.getLoadRate();
    const consumptionRate = this.desiredRateHz_ * this.controller_.step;

    const bufferSeconds = calculateBufferTime(loadedAhead, consumptionRate);

    const timeToStarvation = predictTimeUntilStarvation(
      loadedAhead,
      consumptionRate,
      loadRate
    );

    const targetBuffer = this.strategy_.resumeBufferSeconds * consumptionRate;
    const timeToRecover = estimateTimeToRecover(
      loadedAhead,
      targetBuffer,
      loadRate,
      consumptionRate
    );

    const isCurrentlyPaused = this.controller_.rateHz === 0;
    if (
      !isCurrentlyPaused &&
      this.strategy_.shouldPause(bufferSeconds, timeToStarvation)
    ) {
      Logger.debug(
        "BufferedPlaybackController",
        `Pausing playback due to low buffer: ${bufferSeconds.toFixed(2)}s, predicted starvation in ${timeToStarvation.toFixed(2)}s`
      );
      this.controller_.rateHz = 0;
    } else if (
      isCurrentlyPaused &&
      this.strategy_.shouldResume(bufferSeconds, timeToRecover)
    ) {
      Logger.debug(
        "BufferedPlaybackController",
        `Resuming playback due to recovered buffer: ${bufferSeconds.toFixed(2)}s, predicted recovery in ${timeToRecover.toFixed(2)}s`
      );
      this.controller_.rateHz = this.desiredRateHz_;
    }

    this.controller_.update(timestamp);
  }
}

type LoadEvent = {
  timestamp: number;
  maxLoaded: number;
};

export class LoadingStatistics {
  private loadEvents_: LoadEvent[] = [];
  private readonly windowSizeMs_: number;

  constructor(windowSizeMs: number = 5000) {
    this.windowSizeMs_ = windowSizeMs;
  }

  recordLoadState(timestamp: number, maxLoaded: number): void {
    this.loadEvents_.push({ timestamp, maxLoaded });
    this.pruneOldSamples(timestamp);
  }

  getLoadRate(): number {
    if (this.loadEvents_.length < 2) {
      return 0;
    }

    const oldest = this.loadEvents_[0];
    const newest = this.loadEvents_[this.loadEvents_.length - 1];
    const deltaTime = (newest.timestamp - oldest.timestamp) / 1000; // to seconds

    if (deltaTime <= 0) {
      return 0;
    }

    const deltaLoaded = newest.maxLoaded - oldest.maxLoaded;
    return deltaLoaded / deltaTime;
  }

  private pruneOldSamples(currentTime: number): void {
    const cutoffTime = currentTime - this.windowSizeMs_;
    let firstValidIndex = 0;
    while (
      firstValidIndex < this.loadEvents_.length &&
      this.loadEvents_[firstValidIndex].timestamp < cutoffTime
    ) {
      firstValidIndex++;
    }
    if (firstValidIndex > 0) {
      this.loadEvents_ = this.loadEvents_.slice(firstValidIndex);
    }
  }
}

/**
 * Calculate how many seconds of buffer are currently available.
 */
export function calculateBufferTime(
  loadedAhead: number,
  consumptionRate: number
): number {
  if (consumptionRate <= 0) {
    return Infinity;
  }
  return loadedAhead / consumptionRate;
}

/**
 * Predict how long until buffer starvation occurs.
 * Returns Infinity if loading is keeping up with consumption.
 */
export function predictTimeUntilStarvation(
  currentBuffer: number,
  consumptionRate: number,
  loadRate: number
): number {
  const netRate = loadRate - consumptionRate;
  if (netRate >= 0) {
    return Infinity; // Loading faster than or equal to consuming
  }
  return currentBuffer / Math.abs(netRate);
}

/**
 * Estimate how long it will take to recover to target buffer level.
 * Returns Infinity if unable to recover (loading too slow).
 * Returns 0 only if already at target AND load rate can sustain consumption.
 */
export function estimateTimeToRecover(
  currentBuffer: number,
  targetBuffer: number,
  loadRate: number,
  consumptionRate: number
): number {
  const netRate = loadRate - consumptionRate;
  if (netRate <= 0) {
    return Infinity; // Can't recover or sustain
  }
  if (currentBuffer >= targetBuffer) {
    return 0; // Already at target and can sustain
  }
  return (targetBuffer - currentBuffer) / netRate;
}

export class AdaptiveBufferStrategy {
  private minBufferSeconds_: number;
  private resumeBufferSeconds_: number;

  constructor(
    minBufferSeconds: number = 2.0,
    resumeBufferSeconds: number = 5.0
  ) {
    this.minBufferSeconds_ = minBufferSeconds;
    this.resumeBufferSeconds_ = resumeBufferSeconds;
  }

  shouldPause(bufferSeconds: number, predictedStarvationTime: number): boolean {
    return (
      bufferSeconds < this.minBufferSeconds_ ||
      predictedStarvationTime < this.minBufferSeconds_
    );
  }

  shouldResume(bufferSeconds: number, estimatedRecoveryTime: number): boolean {
    return (
      bufferSeconds >= this.resumeBufferSeconds_ &&
      estimatedRecoveryTime < Infinity
    );
  }

  get minBufferSeconds(): number {
    return this.minBufferSeconds_;
  }

  get resumeBufferSeconds(): number {
    return this.resumeBufferSeconds_;
  }
}
export { DataAvailability };

