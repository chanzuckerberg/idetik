import {
  PlaybackController,
  SimplePlaybackController,
} from "./playback_controller";

export interface DataAvailability {
  isLoaded(index: number): boolean;
  getLoadedAheadOf(position: number): number;
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

/**
 * Strategy for making adaptive pause/resume decisions based on buffer health.
 */
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

  /**
   * Determine if playback should pause due to low buffer.
   */
  shouldPause(bufferSeconds: number, predictedStarvationTime: number): boolean {
    // Pause if buffer is below minimum or predicted to starve soon
    return (
      bufferSeconds < this.minBufferSeconds_ ||
      predictedStarvationTime < this.minBufferSeconds_
    );
  }

  /**
   * Determine if playback should resume after buffering.
   */
  shouldResume(bufferSeconds: number, estimatedRecoveryTime: number): boolean {
    // Resume if buffer is healthy and can maintain playback
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

type BufferedPlaybackControllerProps = {
  dataAvailability: DataAvailability;
  start: number;
  stop: number;
  step: number;
  rateHz?: number;
  minBufferSeconds?: number;
  resumeBufferSeconds?: number;
  loadingWindowMs?: number;
};

export class BufferedPlaybackController implements PlaybackController {
  private controller_: SimplePlaybackController;
  private dataAvailability_: DataAvailability;
  private loadingStats_: LoadingStatistics;
  private strategy_: AdaptiveBufferStrategy;
  private desiredRateHz_: number;

  constructor(props: BufferedPlaybackControllerProps) {
    const desiredRateHz = props.rateHz ?? 0;
    this.controller_ = new SimplePlaybackController({
      start: props.start,
      stop: props.stop,
      step: props.step,
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
    // If currently playing (not buffering), update the controller rate
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
    // 1. Get current position and loaded data
    const currentPos = this.controller_.value;
    const loadedAhead = this.dataAvailability_.getLoadedAheadOf(currentPos);

    // 2. Update loading statistics
    this.loadingStats_.recordLoadState(timestamp, currentPos + loadedAhead);

    // 3. Calculate metrics
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

    // 4. Make adaptive pause/resume decision
    const isCurrentlyPaused = this.controller_.rateHz === 0;

    if (
      !isCurrentlyPaused &&
      this.strategy_.shouldPause(bufferSeconds, timeToStarvation)
    ) {
      // Pause for buffering
      this.controller_.rateHz = 0;
    } else if (
      isCurrentlyPaused &&
      this.strategy_.shouldResume(bufferSeconds, timeToRecover)
    ) {
      // Resume playback
      this.controller_.rateHz = this.desiredRateHz_;
    }

    // 5. Update the underlying controller
    this.controller_.update(timestamp);
  }
}
