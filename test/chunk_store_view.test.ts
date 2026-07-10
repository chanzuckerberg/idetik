import { describe, expect, test } from "vitest";
import { mat4 } from "gl-matrix";
import { ChunkStore } from "@/data/chunk_store";
import { ChunkStoreView } from "@/data/chunk_store_view";
import { SourceDimensionMap } from "@/data/chunk";
import {
  createNoPrefetchPolicy,
  createPlaybackPolicy,
} from "@/core/image_source_policy";
import { OrthographicCamera } from "@/objects/cameras/orthographic_camera";
import { Viewport } from "@/core/viewport";
import { createTestViewport } from "./helpers";

function imageView(viewport: Viewport) {
  return {
    worldViewRect: (viewport.camera as OrthographicCamera).getWorldViewRect(),
    bufferWidthPx: viewport.getBufferRect().width,
  };
}

describe("ChunkStoreView disposal", () => {
  test("disposed view's chunks ready for cancellation", () => {
    const store = new ChunkStore(createSimpleDimensions());
    const policy = createNoPrefetchPolicy();
    const view = store.addView(policy);
    const viewport = createTestViewport();

    // mark some chunks as visible/needed
    view.updateChunksForImage({ z: 0, c: [0], t: 0 }, imageView(viewport));
    expect(view.chunkViewStates.size).toBeGreaterThan(0);

    // aggregate states and set priority
    let collectedChunks = store.updateAndCollectChunkChanges();
    expect(collectedChunks.size).toBeGreaterThan(0);

    // verify some chunks have priority (are needed)
    for (const chunk of collectedChunks) {
      expect(chunk.priority).not.toBe(null);
    }

    view.dispose();

    // collection should return affected chunks from the disposed view
    // chunks should have priority=null and visible=false (ready for cancellation)
    collectedChunks = store.updateAndCollectChunkChanges();

    expect(collectedChunks.size).toBeGreaterThan(0);

    for (const chunk of collectedChunks) {
      expect(chunk.priority).toBe(null);
      expect(chunk.visible).toBe(false);
    }
  });

  test("disposed view's chunks needed by another view", () => {
    const store = new ChunkStore(createSimpleDimensions());
    const policy = createNoPrefetchPolicy();

    const view1 = store.addView(policy);
    const view2 = store.addView(policy);
    const viewport = createTestViewport();

    // Both views mark same chunks as needed
    view1.updateChunksForImage({ z: 0, c: [0], t: 0 }, imageView(viewport));
    view2.updateChunksForImage({ z: 0, c: [0], t: 0 }, imageView(viewport));

    store.updateAndCollectChunkChanges();

    view1.dispose();

    const collectedChunks = store.updateAndCollectChunkChanges();
    expect(collectedChunks.size).toBeGreaterThan(0);

    // chunks should still have priority because view2 still needs them
    for (const chunk of collectedChunks) {
      expect(chunk.priority).not.toBe(null);
    }
  });
});

describe("ChunkStoreView temporal prefetch", () => {
  test("keeps scalar temporal prefetch forward-only and circular", () => {
    const { view } = createTemporalView(5, 2);

    view.updateChunksForImage(
      { z: 0, c: [0], t: 4 },
      imageView(createTestViewport())
    );

    expect(prefetchedTimeIndices(view)).toEqual([0, 1]);
  });

  test.each([
    {
      label: "scalar",
      temporalPrefetch: 99,
      expectedOrderKeys: [
        [0, 3],
        [1, 4],
        [3, 1],
        [4, 2],
      ] as const,
    },
    {
      label: "tuple",
      temporalPrefetch: [99, 99] as const,
      expectedOrderKeys: [
        [0, 2],
        [1, 1],
        [3, 1],
        [4, 2],
      ] as const,
    },
  ])(
    "caps oversized $label windows without overwriting chunk states",
    ({ temporalPrefetch, expectedOrderKeys }) => {
      const { view } = createTemporalView(5, temporalPrefetch);

      view.updateChunksForVolume({ c: [0], t: 2 }, mat4.create());

      expect(prefetchedTimeIndices(view)).toEqual([0, 1, 3, 4]);
      expectCurrentTimeVisible(view, 2);
      expectPrefetchOrderKeys(view, expectedOrderKeys);
    }
  );

  test("uses tuple temporal prefetch as [backward, forward]", () => {
    const { policy, view } = createTemporalView(7, [2, 1]);

    view.updateChunksForImage(
      { z: 0, c: [0], t: 3 },
      imageView(createTestViewport())
    );

    expect(prefetchedTimeIndices(view)).toEqual([1, 2, 4]);
    for (const [chunk, state] of view.chunkViewStates) {
      if (!state.prefetch) continue;
      const temporalDistance = Math.abs(chunk.chunkIndex.t - 3);
      expect(state.priority).toBe(policy.priorityMap.prefetchTime);
      expect(state.orderKey).toBeGreaterThanOrEqual(temporalDistance);
      expect(state.orderKey).toBeLessThan(temporalDistance + 1);
    }
  });

  test("wraps tuple temporal prefetch in both directions for volumes", () => {
    const { policy, view } = createTemporalView(5, [1, 1]);

    view.updateChunksForVolume({ c: [0], t: 0 }, mat4.create());

    expect(prefetchedTimeIndices(view)).toEqual([1, 4]);
    for (const [, state] of view.chunkViewStates) {
      if (!state.prefetch) continue;
      expect(state.priority).toBe(policy.priorityMap.prefetchTime);
      expect(state.orderKey).toBe(1);
    }
  });

  test.each([
    {
      direction: "forward",
      temporalPrefetch: [0, 2] as const,
      expectedTimeIndices: [1, 2],
    },
    {
      direction: "backward",
      temporalPrefetch: [2, 0] as const,
      expectedTimeIndices: [3, 4],
    },
  ])(
    "selects only the $direction tuple direction near a wrap boundary",
    ({ temporalPrefetch, expectedTimeIndices }) => {
      const { view } = createTemporalView(5, temporalPrefetch);

      view.updateChunksForVolume({ c: [0], t: 0 }, mat4.create());

      expect(prefetchedTimeIndices(view)).toEqual(expectedTimeIndices);
    }
  );

  test("deduplicates overlapping ranges using nearest ring distance", () => {
    const { view } = createTemporalView(5, [3, 3]);

    view.updateChunksForVolume({ c: [0], t: 0 }, mat4.create());

    expect(prefetchedTimeIndices(view)).toEqual([1, 2, 3, 4]);
    expectPrefetchOrderKeys(view, [
      [1, 1],
      [2, 2],
      [3, 2],
      [4, 1],
    ]);
  });
});

function createTemporalView(
  timePointCount: number,
  temporalPrefetch: number | readonly [backward: number, forward: number]
) {
  const policy = createPlaybackPolicy({
    prefetch: { x: 0, y: 0, z: 0, t: temporalPrefetch },
  });
  const store = new ChunkStore(createTemporalDimensions(timePointCount));
  return { policy, view: store.addView(policy) };
}

function prefetchedTimeIndices(view: ChunkStoreView): number[] {
  const timeIndices = new Set<number>();
  for (const [chunk, state] of view.chunkViewStates) {
    if (!state.prefetch) continue;
    timeIndices.add(chunk.chunkIndex.t);
  }
  return [...timeIndices].sort((a, b) => a - b);
}

function expectCurrentTimeVisible(
  view: ChunkStoreView,
  currentTimeIndex: number
): void {
  const currentStates = [...view.chunkViewStates].filter(
    ([chunk]) => chunk.chunkIndex.t === currentTimeIndex
  );
  expect(currentStates.length).toBeGreaterThan(0);
  for (const [, state] of currentStates) {
    expect(state.visible).toBe(true);
    expect(state.prefetch).toBe(false);
  }
}

function expectPrefetchOrderKeys(
  view: ChunkStoreView,
  expected: ReadonlyArray<readonly [timeIndex: number, orderKey: number]>
): void {
  for (const [timeIndex, orderKey] of expected) {
    const states = [...view.chunkViewStates].filter(
      ([chunk]) => chunk.chunkIndex.t === timeIndex
    );
    expect(states.length).toBeGreaterThan(0);
    for (const [, state] of states) {
      expect(state.prefetch).toBe(true);
      expect(state.orderKey).toBe(orderKey);
    }
  }
}

function createTemporalDimensions(timePointCount: number): SourceDimensionMap {
  return {
    ...createSimpleDimensions(),
    t: {
      name: "t",
      index: 3,
      lods: [
        {
          size: timePointCount,
          scale: 1,
          chunkSize: 1,
          translation: 0,
        },
      ],
    },
  };
}

function createSimpleDimensions(): SourceDimensionMap {
  return {
    x: {
      name: "x",
      index: 0,
      lods: [
        {
          size: 512,
          scale: 1,
          chunkSize: 256,
          translation: 0,
        },
      ],
    },
    y: {
      name: "y",
      index: 1,
      lods: [
        {
          size: 512,
          scale: 1,
          chunkSize: 256,
          translation: 0,
        },
      ],
    },
    z: {
      name: "z",
      index: 2,
      lods: [
        {
          size: 10,
          scale: 1,
          chunkSize: 5,
          translation: 0,
        },
      ],
    },
    numLods: 1,
  };
}
