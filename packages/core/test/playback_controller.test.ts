import { expect, test } from "vitest";

import {
  PlaybackController,
  DataAvailability,
  LoadingStatistics,
  BufferHealth,
  AdaptiveBufferStrategy,
  AdaptiveBufferManager,
} from "@";

test("PlaybackController initializes with start value", () => {
  const controller = new PlaybackController({
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 0,
  });
  expect(controller.value).toBe(0);
  expect(controller.rateHz).toBe(0);
});

test("PlaybackController advances at specified rate", () => {
  const controller = new PlaybackController({
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 10,
  });

  controller.update(1000);
  controller.update(1100); // 100ms = 0.1s, at 10Hz should advance 1 step
  expect(controller.value).toBe(1);

  controller.update(1200); // another 100ms
  expect(controller.value).toBe(2);
});

test("PlaybackController wraps around at stop", () => {
  const controller = new PlaybackController({
    start: 0,
    stop: 10,
    step: 1,
    rateHz: 10,
  });

  controller.value = 10;
  controller.update(1000);
  controller.update(1100); // should wrap to start
  expect(controller.value).toBe(0);
});

test("LoadingStatistics tracks loading rate", () => {
  const stats = new LoadingStatistics(1000);

  stats.recordLoadState(1000, 0);
  stats.recordLoadState(2000, 10); // 10 indices in 1 second = 10 indices/s

  expect(stats.getLoadRate()).toBe(10);
});

test("LoadingStatistics returns 0 with insufficient data", () => {
  const stats = new LoadingStatistics();
  expect(stats.getLoadRate()).toBe(0);

  stats.recordLoadState(1000, 0);
  expect(stats.getLoadRate()).toBe(0);
});

test("LoadingStatistics prunes old samples", () => {
  const stats = new LoadingStatistics(1000); // 1 second window

  stats.recordLoadState(1000, 0);
  stats.recordLoadState(2000, 10);
  stats.recordLoadState(3000, 20); // First sample should be pruned

  // Rate should be calculated from samples at 2000 and 3000
  expect(stats.getLoadRate()).toBe(10);
});

test("BufferHealth calculates buffer time correctly", () => {
  const health = new BufferHealth();
  const bufferTime = health.calculateBufferTime(100, 10);
  expect(bufferTime).toBe(10); // 100 indices / 10 indices per second = 10 seconds
});

test("BufferHealth predicts starvation time", () => {
  const health = new BufferHealth();
  const timeToStarvation = health.predictTimeUntilStarvation(
    100, // current buffer
    20, // consumption rate
    10 // load rate
  );
  expect(timeToStarvation).toBe(10); // 100 / (20 - 10) = 10 seconds
});

test("BufferHealth returns Infinity when loading keeps up", () => {
  const health = new BufferHealth();
  const timeToStarvation = health.predictTimeUntilStarvation(
    100, // current buffer
    10, // consumption rate
    20 // load rate (faster than consumption)
  );
  expect(timeToStarvation).toBe(Infinity);
});

test("BufferHealth estimates recovery time", () => {
  const health = new BufferHealth();
  const recoveryTime = health.estimateTimeToRecover(
    50, // current buffer
    100, // target buffer
    20, // load rate
    10 // consumption rate
  );
  expect(recoveryTime).toBe(5); // (100 - 50) / (20 - 10) = 5 seconds
});

test("BufferHealth returns 0 when already at target", () => {
  const health = new BufferHealth();
  const recoveryTime = health.estimateTimeToRecover(100, 100, 20, 10);
  expect(recoveryTime).toBe(0);
});

test("AdaptiveBufferStrategy decides to pause on low buffer", () => {
  const strategy = new AdaptiveBufferStrategy(2.0, 5.0);
  expect(strategy.shouldPause(1.0, 10)).toBe(true); // buffer below minimum
  expect(strategy.shouldPause(3.0, 1.0)).toBe(true); // starvation predicted soon
  expect(strategy.shouldPause(3.0, 10)).toBe(false); // healthy buffer
});

test("AdaptiveBufferStrategy decides to resume with sufficient buffer", () => {
  const strategy = new AdaptiveBufferStrategy(2.0, 5.0);
  expect(strategy.shouldResume(6.0, 10)).toBe(true); // above resume threshold
  expect(strategy.shouldResume(4.0, 10)).toBe(false); // below resume threshold
  expect(strategy.shouldResume(6.0, Infinity)).toBe(false); // can't recover
});

test("AdaptiveBufferManager pauses playback on low buffer", () => {
  class MockDataAvailability implements DataAvailability {
    private loadedTo_ = 0;

    setLoadedTo(value: number) {
      this.loadedTo_ = value;
    }

    isLoaded(index: number): boolean {
      return index <= this.loadedTo_;
    }

    getLoadedAheadOf(position: number): number {
      return Math.max(0, this.loadedTo_ - position);
    }
  }

  const controller = new PlaybackController({
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 0,
  });

  const dataAvailability = new MockDataAvailability();
  dataAvailability.setLoadedTo(5); // Only 5 indices loaded

  const manager = new AdaptiveBufferManager(controller, dataAvailability, 10, {
    minBufferSeconds: 2.0,
    resumeBufferSeconds: 5.0,
  });

  // Initially playing
  manager.setDesiredRate(10);
  manager.update(1000);

  // With only 5 indices loaded and consumption rate of 10 indices/s,
  // buffer is 0.5 seconds, which is below minimum of 2 seconds
  // Should pause after a few updates once statistics are gathered
  manager.update(1100);
  manager.update(1200);

  expect(controller.rateHz).toBe(0);
  expect(manager.isBuffering).toBe(true);
});

test("AdaptiveBufferManager resumes playback with sufficient buffer", () => {
  class MockDataAvailability implements DataAvailability {
    private loadedTo_ = 0;

    setLoadedTo(value: number) {
      this.loadedTo_ = value;
    }

    isLoaded(index: number): boolean {
      return index <= this.loadedTo_;
    }

    getLoadedAheadOf(position: number): number {
      return Math.max(0, this.loadedTo_ - position);
    }
  }

  const controller = new PlaybackController({
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 0,
  });

  const dataAvailability = new MockDataAvailability();
  dataAvailability.setLoadedTo(100); // Plenty of data loaded

  const manager = new AdaptiveBufferManager(controller, dataAvailability, 10, {
    minBufferSeconds: 2.0,
    resumeBufferSeconds: 5.0,
  });

  // Start buffering (paused)
  manager.update(1000);
  expect(controller.rateHz).toBe(0);

  // Update a few times to gather statistics and make decision
  dataAvailability.setLoadedTo(100);
  manager.update(1100);
  dataAvailability.setLoadedTo(110);
  manager.update(1200);
  dataAvailability.setLoadedTo(120);
  manager.update(1300);

  // Should resume since buffer is sufficient
  expect(controller.rateHz).toBe(10);
  expect(manager.isBuffering).toBe(false);
});

test("AdaptiveBufferManager exposes step getter", () => {
  const controller = new PlaybackController({
    start: 0,
    stop: 100,
    step: 2,
    rateHz: 0,
  });

  expect(controller.step).toBe(2);
});
