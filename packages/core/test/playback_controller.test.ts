import { SimplePlaybackController } from "@/core/playback_controller";
import { expect, test } from "vitest";

test("SimplePlaybackController initializes with start value", () => {
  const controller = new SimplePlaybackController({
    start: 0,
    stop: 100,
    step: 1,
    rateHz: 0,
  });
  expect(controller.value).toBe(0);
  expect(controller.rateHz).toBe(0);
});

test("SimplePlaybackController advances at specified rate", () => {
  const controller = new SimplePlaybackController({
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

test("SimplePlaybackController wraps around at stop", () => {
  const controller = new SimplePlaybackController({
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
