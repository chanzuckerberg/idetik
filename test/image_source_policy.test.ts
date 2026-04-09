import { expect, test } from "vitest";
import {
  PriorityCategory,
  createImageSourcePolicy,
  createExplorationPolicy,
  createNoPrefetchPolicy,
  createPlaybackPolicy,
} from "@";

const VALID_PRIORITY_ORDER: PriorityCategory[] = [
  "fallbackVisible",
  "prefetchTime",
  "visibleCurrent",
  "fallbackBackground",
  "prefetchSpace",
];

test("createImageSourcePolicy fills defaults for optional fields", () => {
  const p = createImageSourcePolicy({
    prefetch: { x: 1, y: 2 },
    priorityOrder: VALID_PRIORITY_ORDER,
  });

  expect(p.profile).toBe("custom");
  expect(p.prefetch).toEqual({ x: 1, y: 2, z: 0, t: 0 });
  expect(p.lod).toEqual({ min: 0, max: Number.MAX_SAFE_INTEGER, bias: 0.5 });
  expect(Object.keys(p.priorityMap)).toHaveLength(5);
  expect(Object.isFrozen(p.priorityMap)).toBe(true);
});

test("createExplorationPolicy sets exploration defaults", () => {
  const p = createExplorationPolicy();

  expect(p.profile).toBe("exploration");
  expect(p.prefetch).toEqual({ x: 1, y: 1, z: 1, t: 0 });
  expect(Object.keys(p.priorityMap)).toHaveLength(5);
  expect(p.priorityMap).toEqual({
    fallbackVisible: 0,
    visibleCurrent: 1,
    prefetchSpace: 2,
    prefetchTime: 3,
    fallbackBackground: 4,
  });
});

test("createNoPrefetchPolicy sets playback defaults", () => {
  const p = createNoPrefetchPolicy();

  expect(p.profile).toBe("no-prefetch");
  expect(p.prefetch).toEqual({ x: 0, y: 0, z: 0, t: 0 });
  expect(Object.keys(p.priorityMap)).toHaveLength(5);
  expect(p.priorityMap).toEqual({
    fallbackVisible: 0,
    visibleCurrent: 1,
    fallbackBackground: 2,
    prefetchSpace: 3,
    prefetchTime: 4,
  });
});

test("createPlaybackPolicy sets playback defaults", () => {
  const p = createPlaybackPolicy();

  expect(p.profile).toBe("playback");
  expect(p.prefetch).toEqual({ x: 0, y: 0, z: 0, t: 20 });
  expect(Object.keys(p.priorityMap)).toHaveLength(5);
  expect(p.priorityMap).toEqual({
    fallbackVisible: 0,
    prefetchTime: 1,
    visibleCurrent: 2,
    fallbackBackground: 3,
    prefetchSpace: 4,
  });
});

test("throws on negative prefetch values", () => {
  expect(() =>
    createImageSourcePolicy({
      prefetch: { x: -1, y: 0 },
      priorityOrder: VALID_PRIORITY_ORDER,
    })
  ).toThrow("prefetch.x must be a non-negative number");
});

test("throws when lod.min > lod.max", () => {
  expect(() =>
    createImageSourcePolicy({
      prefetch: { x: 0, y: 0 },
      priorityOrder: VALID_PRIORITY_ORDER,
      lod: { min: 10, max: 5 },
    })
  ).toThrow("lod.min must be <= lod.max");
});

test("throws if priorityOrder misses a category", () => {
  expect(() =>
    createImageSourcePolicy({
      prefetch: { x: 0, y: 0 },
      priorityOrder: [
        "fallbackVisible",
        "prefetchTime",
        "visibleCurrent",
        "fallbackBackground",
      ],
    })
  ).toThrow("priorityOrder must include all categories exactly once");
});

test("throws if priorityOrder contains duplicates", () => {
  expect(() =>
    createImageSourcePolicy({
      prefetch: { x: 0, y: 0 },
      priorityOrder: [
        "fallbackVisible",
        "prefetchTime",
        "visibleCurrent",
        "fallbackBackground",
        "fallbackVisible", // duplicate
      ],
    })
  ).toThrow("priorityOrder must include all categories exactly once");
});
