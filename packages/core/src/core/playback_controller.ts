export type PlaybackControllerProps = {
  start: number;
  stop: number;
  step: number;
  rateHz?: number;
};

/**
 * Interface for querying data availability/loading state.
 * Implementations report which time points/indices have been loaded.
 */
export interface DataAvailability {
  /**
   * Check if a specific index is loaded.
   */
  isLoaded(index: number): boolean;

  /**
   * Get the maximum contiguous index loaded starting from a position.
   * Returns the count of loaded indices ahead of the position.
   */
  getLoadedAheadOf(position: number): number;
}

export class PlaybackController {
  private readonly start_: number;
  private readonly stop_: number;
  private readonly step_: number;
  private rateHz_: number;
  private value_: number;
  private lastTimestamp_?: DOMHighResTimeStamp;
  private secondsSinceLastStep_: number = 0;

  constructor(props: PlaybackControllerProps) {
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

/**
 * Tracks loading statistics over time to estimate loading rate.
 * Uses a simple moving average over a time window.
 */
export class LoadingStatistics {
  private loadEvents_: Array<{ timestamp: number; maxLoaded: number }> = [];
  private readonly windowSizeMs_: number;

  constructor(windowSizeMs: number = 5000) {
    this.windowSizeMs_ = windowSizeMs;
  }

  /**
   * Record the current loading state.
   */
  recordLoadState(timestamp: number, maxLoaded: number): void {
    this.loadEvents_.push({ timestamp, maxLoaded });
    this.pruneOldSamples(timestamp);
  }

  /**
   * Get the estimated loading rate in indices per second.
   * Returns 0 if insufficient data.
   */
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
 * Calculates buffer health metrics and predictions.
 */
export class BufferHealth {
  /**
   * Calculate how many seconds of buffer are currently available.
   */
  calculateBufferTime(loadedAhead: number, consumptionRate: number): number {
    if (consumptionRate <= 0) {
      return Infinity;
    }
    return loadedAhead / consumptionRate;
  }

  /**
   * Predict how long until buffer starvation occurs.
   * Returns Infinity if loading is keeping up with consumption.
   */
  predictTimeUntilStarvation(
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
  estimateTimeToRecover(
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

/**
 * Manages adaptive buffering for a PlaybackController.
 * Automatically pauses/resumes playback based on data availability and loading statistics.
 */
export class AdaptiveBufferManager {
  private controller_: PlaybackController;
  private dataAvailability_: DataAvailability;
  private loadingStats_: LoadingStatistics;
  private bufferHealth_: BufferHealth;
  private strategy_: AdaptiveBufferStrategy;
  private desiredRateHz_: number;

  constructor(
    controller: PlaybackController,
    dataAvailability: DataAvailability,
    desiredRateHz: number,
    options?: {
      minBufferSeconds?: number;
      resumeBufferSeconds?: number;
      loadingWindowMs?: number;
    }
  ) {
    this.controller_ = controller;
    this.dataAvailability_ = dataAvailability;
    this.desiredRateHz_ = desiredRateHz;
    this.loadingStats_ = new LoadingStatistics(options?.loadingWindowMs);
    this.bufferHealth_ = new BufferHealth();
    this.strategy_ = new AdaptiveBufferStrategy(
      options?.minBufferSeconds,
      options?.resumeBufferSeconds
    );
  }

  /**
   * Update the buffer manager and controller.
   * Should be called each frame with the current timestamp.
   */
  update(timestamp: DOMHighResTimeStamp): void {
    // 1. Get current position and loaded data
    const currentPos = this.controller_.value;
    const loadedAhead = this.dataAvailability_.getLoadedAheadOf(currentPos);

    // 2. Update loading statistics
    this.loadingStats_.recordLoadState(timestamp, currentPos + loadedAhead);

    // 3. Calculate metrics
    const loadRate = this.loadingStats_.getLoadRate();
    const consumptionRate = this.desiredRateHz_ * this.controller_.step;

    const bufferSeconds = this.bufferHealth_.calculateBufferTime(
      loadedAhead,
      consumptionRate
    );

    const timeToStarvation = this.bufferHealth_.predictTimeUntilStarvation(
      loadedAhead,
      consumptionRate,
      loadRate
    );

    const targetBuffer = this.strategy_.resumeBufferSeconds * consumptionRate;
    const timeToRecover = this.bufferHealth_.estimateTimeToRecover(
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

  /**
   * Set the desired playback rate.
   * This is separate from the actual controller rate, which may be 0 due to buffering.
   */
  setDesiredRate(rateHz: number): void {
    this.desiredRateHz_ = rateHz;
    // If currently playing (not buffering), update the controller rate
    if (this.controller_.rateHz > 0) {
      this.controller_.rateHz = rateHz;
    }
  }

  /**
   * Get the desired playback rate (may differ from actual rate if buffering).
   */
  get desiredRateHz(): number {
    return this.desiredRateHz_;
  }

  /**
   * Check if currently paused for buffering.
   */
  get isBuffering(): boolean {
    return this.controller_.rateHz === 0 && this.desiredRateHz_ > 0;
  }

  /**
   * Access the underlying playback controller.
   */
  get controller(): PlaybackController {
    return this.controller_;
  }
}
