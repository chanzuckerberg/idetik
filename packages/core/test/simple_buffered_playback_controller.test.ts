import { SimpleBufferedPlaybackController } from "@/core/simple_buffered_playback_controller";
import { DataAvailability } from "@/core/playback_controller";
import { expect, test } from "vitest";

class MockDataAvailability implements DataAvailability {
  private loadedTo_ = 0;

  constructor(loadedTo: number) {
    this.loadedTo_ = loadedTo;
  }

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

test("SimpleBufferedPlaybackController initializes with correct properties", () => {
  const controller = new SimpleBufferedPlaybackController({
    dataAvailability: new MockDataAvailability(100),
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 10,
    bufferSize: 20,
  });

  expect(controller.rateHz).toBe(10);
  expect(controller.value).toBe(0);
  expect(controller.step).toBe(1);
});

test("SimpleBufferedPlaybackController allows setting rateHz", () => {
  const controller = new SimpleBufferedPlaybackController({
    dataAvailability: new MockDataAvailability(100),
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 10,
    bufferSize: 20,
  });

  controller.rateHz = 20;
  expect(controller.rateHz).toBe(20);
});

test("SimpleBufferedPlaybackController allows setting value", () => {
  const controller = new SimpleBufferedPlaybackController({
    dataAvailability: new MockDataAvailability(100),
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 10,
    bufferSize: 20,
  });

  controller.value = 50;
  expect(controller.value).toBe(50);
});

test("SimpleBufferedPlaybackController pauses playback when buffer is below threshold", () => {
  const dataAvailability = new MockDataAvailability(10);

  const controller = new SimpleBufferedPlaybackController({
    dataAvailability,
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 10,
    bufferSize: 20, // Need 20 indices buffered
  });

  // Initially, the controller should be at desired rate
  expect(controller.rateHz).toBe(10);
  expect(controller.isBuffering).toBe(false);

  // Update - should detect insufficient buffer and pause
  controller.update(1000);

  // The controller should be buffering
  expect(controller.rateHz).toBe(10); // Desired rate is still 10
  expect(controller.isBuffering).toBe(true); // But it's buffering
});

test("SimpleBufferedPlaybackController resumes playback when buffer reaches threshold", () => {
  const dataAvailability = new MockDataAvailability(10);

  const controller = new SimpleBufferedPlaybackController({
    dataAvailability,
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 10,
    bufferSize: 20,
  });

  // Start buffering
  controller.update(1000);
  expect(controller.isBuffering).toBe(true);

  // Increase buffer to meet threshold
  dataAvailability.setLoadedTo(25);
  controller.update(1100);

  // Should resume playback
  expect(controller.rateHz).toBe(10);
  expect(controller.isBuffering).toBe(false);
});

test("SimpleBufferedPlaybackController maintains playback with sufficient buffer", () => {
  const dataAvailability = new MockDataAvailability(50);

  const controller = new SimpleBufferedPlaybackController({
    dataAvailability,
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 10,
    bufferSize: 20,
  });

  // Update multiple times with sufficient buffer
  controller.update(1000);
  controller.update(1100);
  controller.update(1200);

  // Should maintain playback
  expect(controller.rateHz).toBe(10);
  expect(controller.isBuffering).toBe(false);
});

test("SimpleBufferedPlaybackController advances position during playback", () => {
  const controller = new SimpleBufferedPlaybackController({
    dataAvailability: new MockDataAvailability(1000),
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 10,
    bufferSize: 20,
  });

  const initialValue = controller.value;

  // Update with time progression
  controller.update(0);
  controller.update(100); // 100ms = 0.1s, at 10 Hz = 1 index

  // Position should have advanced
  expect(controller.value).toBeGreaterThan(initialValue);
});

test("SimpleBufferedPlaybackController works without dataAvailability", () => {
  const controller = new SimpleBufferedPlaybackController({
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 10,
    bufferSize: 20,
  });

  // Should not crash when update is called without dataAvailability
  controller.update(1000);

  // Should still function as a normal playback controller
  expect(controller.rateHz).toBe(10);
  expect(controller.value).toBe(0);
});

test("SimpleBufferedPlaybackController buffer threshold is exact", () => {
  const dataAvailability = new MockDataAvailability(19);

  const controller = new SimpleBufferedPlaybackController({
    dataAvailability,
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 10,
    bufferSize: 20,
  });

  // With 19 indices loaded (< 20), should pause
  controller.update(1000);
  expect(controller.isBuffering).toBe(true);

  // With exactly 20 indices loaded, should resume
  dataAvailability.setLoadedTo(20);
  controller.update(1100);
  expect(controller.isBuffering).toBe(false);
});
