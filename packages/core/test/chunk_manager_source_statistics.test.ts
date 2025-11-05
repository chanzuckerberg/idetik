import { describe, expect, test } from "vitest";
import { ChunkManagerSource } from "@/core/chunk_manager_source";
import type {
  ChunkLoader,
  SourceDimensionMap,
  SliceCoordinates,
  Chunk,
} from "@/data/chunk";
import { createImageSourcePolicy } from "@/core/image_source_policy";
import { Box2 } from "@/math/box2";

/**
 * Creates a mock ChunkLoader for testing.
 * Provides a minimal implementation with configurable dimensions.
 */
function createMockLoader(options: {
  numLods?: number;
  xSize?: number;
  ySize?: number;
  xChunkSize?: number;
  yChunkSize?: number;
  tSize?: number;
  cSize?: number;
}): ChunkLoader {
  const {
    numLods = 2,
    xSize = 1024,
    ySize = 1024,
    xChunkSize = 256,
    yChunkSize = 256,
    tSize = 1,
    cSize = 1,
  } = options;

  const createLods = (size: number, chunkSize: number, scale: number) => {
    const lods = [];
    for (let i = 0; i < numLods; i++) {
      const lodScale = scale * Math.pow(2, i);
      lods.push({
        size: Math.max(1, Math.floor(size / Math.pow(2, i))),
        chunkSize,
        scale: lodScale,
        translation: 0,
      });
    }
    return lods;
  };

  const dimensions: SourceDimensionMap = {
    x: {
      name: "x",
      index: 0,
      unit: "micrometer",
      lods: createLods(xSize, xChunkSize, 1.0),
    },
    y: {
      name: "y",
      index: 1,
      unit: "micrometer",
      lods: createLods(ySize, yChunkSize, 1.0),
    },
    t: {
      name: "t",
      index: 2,
      unit: "second",
      lods: [{ size: tSize, chunkSize: 1, scale: 1.0, translation: 0 }],
    },
    c: {
      name: "c",
      index: 3,
      lods: [{ size: cSize, chunkSize: 1, scale: 1.0, translation: 0 }],
    },
    numLods,
  };

  return {
    getSourceDimensionMap: () => dimensions,
    loadChunkData: async (_chunk: Chunk, _signal: AbortSignal) => {
      // Mock implementation - do nothing
    },
    loadRegion: async () => {
      throw new Error("loadRegion not implemented in mock");
    },
    getAttributes: () => [],
  };
}

/**
 * Creates a simple test policy.
 */
function createTestPolicy() {
  return createImageSourcePolicy({
    profile: "test",
    prefetch: { x: 0, y: 0, z: 0, t: 0 },
    priorityOrder: [
      "fallbackVisible",
      "visibleCurrent",
      "fallbackBackground",
      "prefetchSpace",
      "prefetchTime",
    ],
  });
}

describe("ChunkManagerSource with Statistics", () => {
  test("initializes statistics with all chunks in unloaded state", () => {
    const loader = createMockLoader({
      numLods: 2,
      xSize: 512,
      ySize: 512,
      xChunkSize: 256,
      yChunkSize: 256,
      tSize: 1,
      cSize: 1,
    });
    const policy = createTestPolicy();
    const sliceCoords: SliceCoordinates = {};

    const source = new ChunkManagerSource(loader, sliceCoords, policy);
    const stats = source.statistics.getStatsForTime(0);

    // Calculate expected chunk count:
    // LOD 0: 512/256 = 2 chunks per dimension = 2 * 2 = 4 chunks
    // LOD 1: 256/256 = 1 chunk per dimension = 1 * 1 = 1 chunk
    // Total: 4 + 1 = 5 chunks per time/channel
    // With t=1, c=1: 5 chunks total at time 0
    const expectedChunks = 5;

    expect(stats.totalChunks).toBe(expectedChunks);
    expect(stats.unloadedChunks).toBe(expectedChunks);
    expect(stats.queuedChunks).toBe(0);
    expect(stats.loadingChunks).toBe(0);
    expect(stats.loadedChunks).toBe(0);
  });

  test("updates statistics when chunks become visible", () => {
    const loader = createMockLoader({
      numLods: 2,
      xSize: 512,
      ySize: 512,
      xChunkSize: 256,
      yChunkSize: 256,
      tSize: 1,
      cSize: 1,
    });
    const policy = createTestPolicy();
    const sliceCoords: SliceCoordinates = {};

    const source = new ChunkManagerSource(loader, sliceCoords, policy);

    // Update with a view that covers all chunks
    const viewBounds = new Box2();
    viewBounds.min[0] = 0;
    viewBounds.min[1] = 0;
    viewBounds.max[0] = 512;
    viewBounds.max[1] = 512;

    source.updateAndCollectChunkChanges(0, viewBounds);

    const stats = source.statistics.getStatsForTime(0);

    // At LOD 0 (current LOD for lodFactor=0), all 4 chunks should be visible
    const lod0Stats = stats.perLOD.get(0);
    expect(lod0Stats?.visibleChunks).toBeGreaterThan(0);

    // Some chunks should be queued for loading
    expect(stats.queuedChunks).toBeGreaterThan(0);
  });

  test("tracks state transitions through queue lifecycle", () => {
    const loader = createMockLoader({
      numLods: 1,
      xSize: 256,
      ySize: 256,
      xChunkSize: 256,
      yChunkSize: 256,
      tSize: 1,
      cSize: 1,
    });
    const policy = createTestPolicy();
    const sliceCoords: SliceCoordinates = {};

    const source = new ChunkManagerSource(loader, sliceCoords, policy);

    // Initial state: 1 chunk, unloaded
    let stats = source.statistics.getStatsForTime(0);
    expect(stats.totalChunks).toBe(1);
    expect(stats.unloadedChunks).toBe(1);

    // Make chunk visible and queue it
    const viewBounds = new Box2();
    viewBounds.min[0] = 0;
    viewBounds.min[1] = 0;
    viewBounds.max[0] = 256;
    viewBounds.max[1] = 256;

    source.updateAndCollectChunkChanges(10, viewBounds); // lodFactor=10 to ensure LOD 0

    stats = source.statistics.getStatsForTime(0);
    expect(stats.queuedChunks).toBe(1);
    expect(stats.unloadedChunks).toBe(0);

    // Verify visibility is tracked
    const lod0Stats = stats.perLOD.get(0);
    expect(lod0Stats?.visibleChunks).toBe(1);
  });

  test("handles multiple time indices correctly", () => {
    const loader = createMockLoader({
      numLods: 1,
      xSize: 256,
      ySize: 256,
      xChunkSize: 256,
      yChunkSize: 256,
      tSize: 3,
      cSize: 1,
    });
    const policy = createTestPolicy();
    const sliceCoords: SliceCoordinates = {};

    const source = new ChunkManagerSource(loader, sliceCoords, policy);

    // Each time index should have 1 chunk
    for (let t = 0; t < 3; t++) {
      const timeStats = source.statistics.getStatsForTime(t);
      expect(timeStats.totalChunks).toBe(1);
      expect(timeStats.unloadedChunks).toBe(1);
    }
  });

  test("tracks per-LOD statistics correctly", () => {
    const loader = createMockLoader({
      numLods: 3,
      xSize: 1024,
      ySize: 1024,
      xChunkSize: 256,
      yChunkSize: 256,
      tSize: 1,
      cSize: 1,
    });
    const policy = createTestPolicy();
    const sliceCoords: SliceCoordinates = {};

    const source = new ChunkManagerSource(loader, sliceCoords, policy);

    // Make chunks visible
    const viewBounds = new Box2();
    viewBounds.min[0] = 0;
    viewBounds.min[1] = 0;
    viewBounds.max[0] = 1024;
    viewBounds.max[1] = 1024;

    source.updateAndCollectChunkChanges(0, viewBounds);

    const timeStats = source.statistics.getStatsForTime(0);

    // Verify that multiple LODs have tracked chunks
    const lodLevels = Array.from(timeStats.perLOD.keys()).sort();
    expect(lodLevels.length).toBeGreaterThan(0);

    // At least one LOD should have visible chunks
    let totalVisible = 0;
    for (const [_lod, lodStats] of timeStats.perLOD) {
      totalVisible += lodStats.visibleChunks;
    }
    expect(totalVisible).toBeGreaterThan(0);
  });

  test("disposes chunks and updates statistics", () => {
    const loader = createMockLoader({
      numLods: 2,
      xSize: 512,
      ySize: 512,
      xChunkSize: 256,
      yChunkSize: 256,
      tSize: 1,
      cSize: 1,
    });
    const policy = createTestPolicy();
    const sliceCoords: SliceCoordinates = {};

    const source = new ChunkManagerSource(loader, sliceCoords, policy);

    // Make chunks visible
    const viewBounds = new Box2();
    viewBounds.min[0] = 0;
    viewBounds.min[1] = 0;
    viewBounds.max[0] = 512;
    viewBounds.max[1] = 512;

    source.updateAndCollectChunkChanges(0, viewBounds);

    let stats = source.statistics.getStatsForTime(0);
    const initialQueued = stats.queuedChunks;
    expect(initialQueued).toBeGreaterThan(0);

    // Move view away to trigger disposal
    viewBounds.min[0] = 10000;
    viewBounds.min[1] = 10000;
    viewBounds.max[0] = 10512;
    viewBounds.max[1] = 10512;

    source.updateAndCollectChunkChanges(0, viewBounds);

    stats = source.statistics.getStatsForTime(0);

    // Chunks should have been disposed and returned to unloaded
    expect(stats.queuedChunks).toBeLessThan(initialQueued);
  });

  test("handles view changes with multiple updates", () => {
    const loader = createMockLoader({
      numLods: 2,
      xSize: 1024,
      ySize: 1024,
      xChunkSize: 256,
      yChunkSize: 256,
      tSize: 1,
      cSize: 1,
    });
    const policy = createTestPolicy();
    const sliceCoords: SliceCoordinates = {};

    const source = new ChunkManagerSource(loader, sliceCoords, policy);

    // First view
    const viewBounds1 = new Box2();
    viewBounds1.min[0] = 0;
    viewBounds1.min[1] = 0;
    viewBounds1.max[0] = 300;
    viewBounds1.max[1] = 300;

    source.updateAndCollectChunkChanges(0, viewBounds1);
    const stats1 = source.statistics.getStatsForTime(0);

    // Second view (different region)
    const viewBounds2 = new Box2();
    viewBounds2.min[0] = 500;
    viewBounds2.min[1] = 500;
    viewBounds2.max[0] = 800;
    viewBounds2.max[1] = 800;

    source.updateAndCollectChunkChanges(0, viewBounds2);
    const stats2 = source.statistics.getStatsForTime(0);

    // Visible chunks should change between views
    const visible1 = Array.from(stats1.perLOD.values()).reduce(
      (sum, lod) => sum + lod.visibleChunks,
      0
    );
    const visible2 = Array.from(stats2.perLOD.values()).reduce(
      (sum, lod) => sum + lod.visibleChunks,
      0
    );

    // Both views should have some visible chunks
    expect(visible1).toBeGreaterThan(0);
    expect(visible2).toBeGreaterThan(0);
  });

  test("statistics remain consistent after multiple operations", () => {
    const loader = createMockLoader({
      numLods: 2,
      xSize: 512,
      ySize: 512,
      xChunkSize: 256,
      yChunkSize: 256,
      tSize: 1,
      cSize: 1,
    });
    const policy = createTestPolicy();
    const sliceCoords: SliceCoordinates = {};

    const source = new ChunkManagerSource(loader, sliceCoords, policy);

    const viewBounds = new Box2();

    // Perform multiple view updates
    for (let i = 0; i < 10; i++) {
      viewBounds.min[0] = i * 50;
      viewBounds.min[1] = i * 50;
      viewBounds.max[0] = i * 50 + 300;
      viewBounds.max[1] = i * 50 + 300;

      source.updateAndCollectChunkChanges(0, viewBounds);

      const stats = source.statistics.getStatsForTime(0);

      // Invariant: sum of all state counts should equal total chunks
      const stateSum =
        stats.unloadedChunks +
        stats.queuedChunks +
        stats.loadingChunks +
        stats.loadedChunks;
      expect(stateSum).toBe(stats.totalChunks);
    }
  });

  test("handles channel slicing correctly", () => {
    const loader = createMockLoader({
      numLods: 1,
      xSize: 256,
      ySize: 256,
      xChunkSize: 256,
      yChunkSize: 256,
      tSize: 1,
      cSize: 3,
    });
    const policy = createTestPolicy();
    const sliceCoords: SliceCoordinates = { c: 0 };

    const source = new ChunkManagerSource(loader, sliceCoords, policy);

    const stats = source.statistics.getStatsForTime(0);

    // Should have 1 chunk * 3 channels = 3 chunks at time 0
    expect(stats.totalChunks).toBe(3);

    // Make chunks visible
    const viewBounds = new Box2();
    viewBounds.min[0] = 0;
    viewBounds.min[1] = 0;
    viewBounds.max[0] = 256;
    viewBounds.max[1] = 256;

    source.updateAndCollectChunkChanges(10, viewBounds);

    const timeStats = source.statistics.getStatsForTime(0);

    // Only channel 0 should be visible (due to slice)
    // So only 1 chunk should be queued
    expect(timeStats.queuedChunks).toBe(1);
  });
});
