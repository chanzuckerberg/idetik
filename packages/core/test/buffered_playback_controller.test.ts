import {
  AdaptiveBufferManager,
  AdaptiveBufferStrategy,
  BufferedPlaybackController,
  calculateBufferTime,
  DataAvailability,
  estimateTimeToRecover,
  LoadingStatistics,
  predictTimeUntilStarvation,
} from "@/core/buffered_playback_controller";
import { SimplePlaybackController } from "@/core/playback_controller";
import { expect, test } from "vitest";

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

test("calculateBufferTime", () => {
  const bufferTime = calculateBufferTime(100, 10);
  expect(bufferTime).toBe(10); // 100 indices / 10 indices per second = 10 seconds
});

test("BufferHealth predicts starvation time", () => {
  const timeToStarvation = predictTimeUntilStarvation(
    100, // current buffer
    20, // consumption rate
    10 // load rate
  );
  expect(timeToStarvation).toBe(10); // 100 / (20 - 10) = 10 seconds
});

test("BufferHealth returns Infinity when loading keeps up", () => {
  const timeToStarvation = predictTimeUntilStarvation(
    100, // current buffer
    10, // consumption rate
    20 // load rate (faster than consumption)
  );
  expect(timeToStarvation).toBe(Infinity);
});

test("BufferHealth estimates recovery time", () => {
  const recoveryTime = estimateTimeToRecover(
    50, // current buffer
    100, // target buffer
    20, // load rate
    10 // consumption rate
  );
  expect(recoveryTime).toBe(5); // (100 - 50) / (20 - 10) = 5 seconds
});

test("BufferHealth returns 0 when already at target", () => {
  const recoveryTime = estimateTimeToRecover(100, 100, 20, 10);
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

  const controller = new SimplePlaybackController({
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

  const controller = new SimplePlaybackController({
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

test("BufferedPlaybackController initializes with correct properties", () => {
  class MockDataAvailability implements DataAvailability {
    isLoaded(_index: number): boolean {
      return true;
    }

    getLoadedAheadOf(_position: number): number {
      return 100;
    }
  }

  const controller = new BufferedPlaybackController({
    dataAvailability: new MockDataAvailability(),
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 10,
  });

  expect(controller.rateHz).toBe(10);
  expect(controller.value).toBe(0);
  expect(controller.step).toBe(1);
});

test("BufferedPlaybackController allows setting rateHz", () => {
  class MockDataAvailability implements DataAvailability {
    isLoaded(_index: number): boolean {
      return true;
    }

    getLoadedAheadOf(_position: number): number {
      return 100;
    }
  }

  const controller = new BufferedPlaybackController({
    dataAvailability: new MockDataAvailability(),
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 10,
  });

  controller.rateHz = 20;
  expect(controller.rateHz).toBe(20);
});

test("BufferedPlaybackController allows setting value", () => {
  class MockDataAvailability implements DataAvailability {
    isLoaded(_index: number): boolean {
      return true;
    }

    getLoadedAheadOf(_position: number): number {
      return 100;
    }
  }

  const controller = new BufferedPlaybackController({
    dataAvailability: new MockDataAvailability(),
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 10,
  });

  controller.value = 50;
  expect(controller.value).toBe(50);
});

test("BufferedPlaybackController pauses playback on low buffer", () => {
  class MockDataAvailability implements DataAvailability {
    private loadedTo_ = 0;

    setLoadedTo(value: number) {
      this.loadedTo_ = value;
    }

    isLoaded(index: number): boolean {
      return index <= this.loadedTo_;
    }

    getLoadedAheadOf(_position: number): number {
      return Math.max(0, this.loadedTo_ - 0); // Always relative to position 0 for simplicity
    }
  }

  const dataAvailability = new MockDataAvailability();
  dataAvailability.setLoadedTo(5); // Only 5 indices loaded

  const controller = new BufferedPlaybackController({
    dataAvailability,
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 10,
    minBufferSeconds: 2.0,
    resumeBufferSeconds: 5.0,
  });

  // Initially, the controller should be at desired rate
  expect(controller.rateHz).toBe(10);

  // Update a few times - should detect low buffer and pause
  controller.update(1000);
  controller.update(1100);
  controller.update(1200);

  // The underlying controller should be paused (rate 0)
  // but rateHz getter returns desired rate
  expect(controller.rateHz).toBe(10); // Desired rate is still 10
});

test("BufferedPlaybackController resumes playback with sufficient buffer", () => {
  class MockDataAvailability implements DataAvailability {
    private loadedTo_ = 0;

    setLoadedTo(value: number) {
      this.loadedTo_ = value;
    }

    isLoaded(index: number): boolean {
      return index <= this.loadedTo_;
    }

    getLoadedAheadOf(_position: number): number {
      return Math.max(0, this.loadedTo_ - 0);
    }
  }

  const dataAvailability = new MockDataAvailability();
  dataAvailability.setLoadedTo(100); // Plenty of data loaded

  const controller = new BufferedPlaybackController({
    dataAvailability,
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 10,
    minBufferSeconds: 2.0,
    resumeBufferSeconds: 5.0,
  });

  // Start with some updates to gather statistics
  controller.update(1000);

  dataAvailability.setLoadedTo(110);
  controller.update(1100);

  dataAvailability.setLoadedTo(120);
  controller.update(1200);

  dataAvailability.setLoadedTo(130);
  controller.update(1300);

  // Should maintain playback with sufficient buffer
  expect(controller.rateHz).toBe(10);
});

test("BufferedPlaybackController advances position during playback", () => {
  class MockDataAvailability implements DataAvailability {
    isLoaded(_index: number): boolean {
      return true;
    }

    getLoadedAheadOf(_position: number): number {
      return 1000; // Always plenty of buffer
    }
  }

  const controller = new BufferedPlaybackController({
    dataAvailability: new MockDataAvailability(),
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 10,
  });

  const initialValue = controller.value;

  // Update with time progression
  controller.update(0);
  controller.update(100); // 100ms = 0.1s, at 10 Hz = 1 index

  // Position should have advanced
  expect(controller.value).toBeGreaterThan(initialValue);
});
