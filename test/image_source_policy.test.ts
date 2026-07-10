import { expect, expectTypeOf, test } from "vitest";
import {
  type ImageSourcePolicy,
  PriorityCategory,
  createImageSourcePolicy,
  createExplorationPolicy,
  createNoPrefetchPolicy,
  createPlaybackPolicy,
} from "@/core/image_source_policy";

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
  expectTypeOf(p.prefetch.t).toEqualTypeOf<number>();
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

test("infers scalar and tuple temporal prefetch readback types", () => {
  type TemporalTuple = readonly [number, number];
  const tupleOverrides = {
    prefetch: { x: 0, y: 0, z: 0, t: [2, 1] as TemporalTuple },
  };
  const createPolicyWithOptionalTuple = (overrides: {
    prefetch?: typeof tupleOverrides.prefetch;
  }) => createPlaybackPolicy(overrides);

  expectTypeOf(createPlaybackPolicy().prefetch.t).toEqualTypeOf<number>();
  expectTypeOf(
    createPlaybackPolicy(tupleOverrides).prefetch.t
  ).toEqualTypeOf<TemporalTuple>();
  expectTypeOf(
    createPolicyWithOptionalTuple
  ).returns.toEqualTypeOf<ImageSourcePolicy>();

  // @ts-expect-error Explicit non-undefined overrides require an argument.
  createPlaybackPolicy<typeof tupleOverrides>();
});

test("copies and freezes temporal prefetch tuples", () => {
  const temporalPrefetch: [number, number] = [2, 1];
  const p = createImageSourcePolicy({
    prefetch: { x: 0, y: 0, t: temporalPrefetch },
    priorityOrder: [...VALID_PRIORITY_ORDER] as const,
  });

  temporalPrefetch[0] = 10;

  expectTypeOf(p.prefetch.t).toEqualTypeOf<readonly [number, number]>();
  expect(p.prefetch.t).toEqual([2, 1]);
  expect(Object.isFrozen(p.prefetch.t)).toBe(true);
});

test("throws on negative prefetch values", () => {
  expect(() =>
    createImageSourcePolicy({
      prefetch: { x: -1, y: 0 },
      priorityOrder: VALID_PRIORITY_ORDER,
    })
  ).toThrow("prefetch.x must be a non-negative number");
});

test("throws on negative temporal tuple values", () => {
  expect(() =>
    createImageSourcePolicy({
      prefetch: { x: 0, y: 0, t: [-1, 0] },
      priorityOrder: VALID_PRIORITY_ORDER,
    })
  ).toThrow("prefetch.t[0] must be a non-negative number");

  expect(() =>
    createImageSourcePolicy({
      prefetch: { x: 0, y: 0, t: [0, -1] },
      priorityOrder: VALID_PRIORITY_ORDER,
    })
  ).toThrow("prefetch.t[1] must be a non-negative number");
});

test("throws on NaN temporal tuple values", () => {
  expect(() =>
    createImageSourcePolicy({
      prefetch: { x: 0, y: 0, t: [NaN, 0] },
      priorityOrder: VALID_PRIORITY_ORDER,
    })
  ).toThrow("prefetch.t[0] must be a non-negative number");

  expect(() =>
    createImageSourcePolicy({
      prefetch: { x: 0, y: 0, t: [0, NaN] },
      priorityOrder: VALID_PRIORITY_ORDER,
    })
  ).toThrow("prefetch.t[1] must be a non-negative number");
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
