import { expect, test, describe } from "vitest";
import { ChunkManagerDataAvailability } from "@";
import { ChunkManagerSource } from "@/core/chunk_manager_source";
import { Box2 } from "@/math/box2";
import { vec2 } from "gl-matrix";
import type {
  ChunkLoader,
  SourceDimensionMap,
  SliceCoordinates,
} from "@/data/chunk";
import { createNoPrefetchPolicy } from "@/core/image_source_policy";

// Create a mock ChunkLoader for testing
function createMockChunkLoader(
  timeSize: number = 5,
  hasTDimension: boolean = true
): ChunkLoader {
  const dimensionMap: SourceDimensionMap = {
    x: {
      name: "x",
      index: 0,
      lods: [
        { size: 256, chunkSize: 256, scale: 1, translation: 0 },
        { size: 128, chunkSize: 128, scale: 2, translation: 0 },
      ],
    },
    y: {
      name: "y",
      index: 1,
      lods: [
        { size: 256, chunkSize: 256, scale: 1, translation: 0 },
        { size: 128, chunkSize: 128, scale: 2, translation: 0 },
      ],
    },
    z: {
      name: "z",
      index: 2,
      lods: [
        { size: 1, chunkSize: 1, scale: 1, translation: 0 },
        { size: 1, chunkSize: 1, scale: 1, translation: 0 },
      ],
    },
    numLods: 2,
  };

  if (hasTDimension) {
    dimensionMap.t = {
      name: "t",
      index: 3,
      lods: [
        { size: timeSize, chunkSize: 1, scale: 1, translation: 0 },
        { size: timeSize, chunkSize: 1, scale: 1, translation: 0 },
      ],
    };
  }

  return {
    getSourceDimensionMap: () => dimensionMap,
    loadChunkData: async () => {},
    loadRegion: async () => {
      throw new Error("Not implemented in mock");
    },
    getAttributes: () => [],
  };
}

describe("ChunkManagerDataAvailability", () => {
  test("isLoaded returns false when no view bounds set", () => {
    const loader = createMockChunkLoader(5);
    const sliceCoords: SliceCoordinates = { t: 0, z: 0 };
    const policy = createNoPrefetchPolicy();
    const chunkManager = new ChunkManagerSource(loader, sliceCoords, policy);

    const dataAvailability = new ChunkManagerDataAvailability(chunkManager);

    // No view bounds set yet, so should return false
    expect(dataAvailability.isLoaded(0)).toBe(false);
  });

  test("isLoaded returns true when all required chunks are loaded", () => {
    const loader = createMockChunkLoader(5);
    const sliceCoords: SliceCoordinates = { t: 0, z: 0 };
    const policy = createNoPrefetchPolicy();
    const chunkManager = new ChunkManagerSource(loader, sliceCoords, policy);

    // Update with view bounds to initialize
    const viewBounds = new Box2(
      vec2.fromValues(0, 0),
      vec2.fromValues(256, 256)
    );
    chunkManager.updateAndCollectChunkChanges(0, viewBounds);

    // Mark all chunks at time 0 and LOD 1 (lowest) as loaded
    const chunks = chunkManager.getChunksAtCurrentTime();
    chunks.forEach((chunk) => {
      if (chunk.lod === chunkManager.lowestResLOD) {
        chunk.state = "loaded";
      }
    });

    const dataAvailability = new ChunkManagerDataAvailability(chunkManager);
    expect(dataAvailability.isLoaded(0)).toBe(true);
  });

  test("isLoaded returns false when some required chunks are not loaded", () => {
    const loader = createMockChunkLoader(5);
    const sliceCoords: SliceCoordinates = { t: 0, z: 0 };
    const policy = createNoPrefetchPolicy();
    const chunkManager = new ChunkManagerSource(loader, sliceCoords, policy);

    // Update with view bounds
    const viewBounds = new Box2(
      vec2.fromValues(0, 0),
      vec2.fromValues(256, 256)
    );
    chunkManager.updateAndCollectChunkChanges(0, viewBounds);

    // Leave chunks unloaded
    const dataAvailability = new ChunkManagerDataAvailability(chunkManager);
    expect(dataAvailability.isLoaded(0)).toBe(false);
  });

  test("getLoadedAheadOf returns count of contiguous loaded indices", () => {
    const loader = createMockChunkLoader(10);
    const sliceCoords: SliceCoordinates = { t: 0, z: 0 };
    const policy = createNoPrefetchPolicy();
    const chunkManager = new ChunkManagerSource(loader, sliceCoords, policy);

    // Update with view bounds at time 0
    const viewBounds = new Box2(
      vec2.fromValues(0, 0),
      vec2.fromValues(256, 256)
    );
    chunkManager.updateAndCollectChunkChanges(0, viewBounds);

    // Directly mark chunks at specific time indices as loaded
    // without calling updateAndCollectChunkChanges which would dispose them
    for (let t = 1; t <= 3; t++) {
      sliceCoords.t = t;
      const chunks = chunkManager.getChunksAtCurrentTime();
      chunks.forEach((chunk) => {
        if (chunk.lod === chunkManager.lowestResLOD) {
          chunk.state = "loaded";
        }
      });
    }

    // Reset to time 0 but DON'T call updateAndCollectChunkChanges
    // to avoid disposing the chunks we just marked
    sliceCoords.t = 0;

    const dataAvailability = new ChunkManagerDataAvailability(chunkManager);

    // From position 0, should have 3 contiguous loaded ahead (1, 2, 3)
    expect(dataAvailability.getLoadedAheadOf(0)).toBe(3);
  });

  test("getLoadedAheadOf returns 0 when next index is not loaded", () => {
    const loader = createMockChunkLoader(10);
    const sliceCoords: SliceCoordinates = { t: 0, z: 0 };
    const policy = createNoPrefetchPolicy();
    const chunkManager = new ChunkManagerSource(loader, sliceCoords, policy);

    // Update with view bounds
    const viewBounds = new Box2(
      vec2.fromValues(0, 0),
      vec2.fromValues(256, 256)
    );
    chunkManager.updateAndCollectChunkChanges(0, viewBounds);

    // Mark only time 0 as loaded
    const chunks = chunkManager.getChunksAtCurrentTime();
    chunks.forEach((chunk) => {
      if (chunk.lod === chunkManager.lowestResLOD) {
        chunk.state = "loaded";
      }
    });

    const dataAvailability = new ChunkManagerDataAvailability(chunkManager);
    expect(dataAvailability.getLoadedAheadOf(0)).toBe(0);
  });

  test("getLoadedAheadOf stops at first non-loaded index", () => {
    const loader = createMockChunkLoader(10);
    const sliceCoords: SliceCoordinates = { t: 0, z: 0 };
    const policy = createNoPrefetchPolicy();
    const chunkManager = new ChunkManagerSource(loader, sliceCoords, policy);

    // Update with view bounds at time 0
    const viewBounds = new Box2(
      vec2.fromValues(0, 0),
      vec2.fromValues(256, 256)
    );
    chunkManager.updateAndCollectChunkChanges(0, viewBounds);

    // Directly mark chunks at specific time indices as loaded
    // Mark 1, 2 loaded, skip 3, mark 4, 5 loaded
    for (const t of [1, 2, 4, 5]) {
      sliceCoords.t = t;
      const chunks = chunkManager.getChunksAtCurrentTime();
      chunks.forEach((chunk) => {
        if (chunk.lod === chunkManager.lowestResLOD) {
          chunk.state = "loaded";
        }
      });
    }

    // Reset to time 0 but DON'T call updateAndCollectChunkChanges
    // to avoid disposing the chunks we just marked
    sliceCoords.t = 0;

    const dataAvailability = new ChunkManagerDataAvailability(chunkManager);

    // Should stop at index 3, only counting 1 and 2
    expect(dataAvailability.getLoadedAheadOf(0)).toBe(2);
  });

  test("setLOD updates the LOD to check", () => {
    const loader = createMockChunkLoader(5);
    const sliceCoords: SliceCoordinates = { t: 0, z: 0 };
    const policy = createNoPrefetchPolicy();
    const chunkManager = new ChunkManagerSource(loader, sliceCoords, policy);

    // Update with view bounds
    const viewBounds = new Box2(
      vec2.fromValues(0, 0),
      vec2.fromValues(256, 256)
    );
    chunkManager.updateAndCollectChunkChanges(0, viewBounds);

    // Mark all chunks at LOD 0 as loaded, but not LOD 1
    const chunks = chunkManager.getChunksAtCurrentTime();
    chunks.forEach((chunk) => {
      if (chunk.lod === 0) {
        chunk.state = "loaded";
      }
    });

    // Start with LOD 1 (not loaded)
    const dataAvailability = new ChunkManagerDataAvailability(chunkManager, 1);
    expect(dataAvailability.isLoaded(0)).toBe(false);

    // Change to LOD 0 (loaded)
    dataAvailability.setLOD(0);
    expect(dataAvailability.lod).toBe(0);
    expect(dataAvailability.isLoaded(0)).toBe(true);
  });
});
