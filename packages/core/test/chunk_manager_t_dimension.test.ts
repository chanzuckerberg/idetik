import { expect, test, describe, vi, beforeEach } from "vitest";
import { vec2 } from "gl-matrix";
import { ChunkManagerSource } from "../src/core/chunk_manager";
import { Box2 } from "../src/math/box2";
import {
  ChunkLoader,
  SourceDimensionMap,
  SliceCoordinates,
  Chunk,
  LoaderAttributes,
} from "../src/data/chunk";

// Mock ChunkLoader for testing
class MockChunkLoader implements ChunkLoader {
  private dimensionMap_: SourceDimensionMap;

  constructor(dimensionMap: SourceDimensionMap) {
    this.dimensionMap_ = dimensionMap;
  }

  getSourceDimensionMap(): SourceDimensionMap {
    return this.dimensionMap_;
  }

  async loadChunkData(
    chunk: Chunk,
    _sliceCoords: SliceCoordinates
  ): Promise<void> {
    chunk.data = new Float32Array(
      chunk.shape.x *
        chunk.shape.y *
        chunk.shape.z *
        chunk.shape.t *
        chunk.shape.c
    );
  }

  async loadRegion(): Promise<Chunk> {
    throw new Error("Not implemented for mock");
  }

  getAttributes(): ReadonlyArray<LoaderAttributes> {
    return [];
  }
}

describe("ChunkManagerSource with t dimension", () => {
  let mockDimensions: SourceDimensionMap;
  let mockLoader: MockChunkLoader;
  let sliceCoords: SliceCoordinates;

  beforeEach(() => {
    // Create 4D spatiotemporal dimension map
    mockDimensions = {
      x: {
        name: "x",
        index: 0,
        lods: [
          { size: 100, chunkSize: 50, scale: 1.0, translation: 0.0 },
          { size: 50, chunkSize: 25, scale: 2.0, translation: 0.0 },
        ],
      },
      y: {
        name: "y",
        index: 1,
        lods: [
          { size: 100, chunkSize: 50, scale: 1.0, translation: 0.0 },
          { size: 50, chunkSize: 25, scale: 2.0, translation: 0.0 },
        ],
      },
      z: {
        name: "z",
        index: 2,
        lods: [
          { size: 10, chunkSize: 5, scale: 1.0, translation: 0.0 },
          { size: 5, chunkSize: 5, scale: 2.0, translation: 0.0 },
        ],
      },
      t: {
        name: "t",
        index: 3,
        lods: [
          { size: 20, chunkSize: 10, scale: 0.1, translation: 0.0 }, // 20 time points, chunks of 10
          { size: 10, chunkSize: 5, scale: 0.2, translation: 0.0 }, // LOD 1: half temporal resolution
        ],
      },
      c: {
        name: "c",
        index: 4,
        lods: [
          { size: 3, chunkSize: 3, scale: 1.0, translation: 0.0 },
          { size: 3, chunkSize: 3, scale: 1.0, translation: 0.0 },
        ],
      },
      numLods: 2,
    };

    mockLoader = new MockChunkLoader(mockDimensions);

    sliceCoords = {
      z: 2.5, // Z slice coordinate
      c: 0, // First channel
      t: 0.5, // Time coordinate at t=0.5
    };
  });

  test("generates 4D spatiotemporal chunks with t dimension", () => {
    const chunkManager = new ChunkManagerSource(mockLoader, sliceCoords);
    const chunks = chunkManager.chunks;

    // Should generate chunks for all 4 spatial+temporal dimensions
    expect(chunks.length).toBeGreaterThan(0);

    // Find a chunk with t dimension data
    const chunkWithT = chunks.find((c) => c.chunkIndex.t > 0);
    expect(chunkWithT).toBeDefined();
    expect(chunkWithT!.shape.t).toBeGreaterThan(0);
    expect(chunkWithT!.chunkIndex.t).toBeGreaterThan(0);
    expect(chunkWithT!.offset.t).toBeGreaterThan(0);
    expect(chunkWithT!.scale.t).toBe(0.1); // From LOD 0
  });

  test("getTBounds returns correct temporal bounds", () => {
    const chunkManager = new ChunkManagerSource(mockLoader, sliceCoords);

    // Access private method using type assertion for testing
    const getTBounds = (
      chunkManager as unknown as { getTBounds: () => [number, number] }
    ).getTBounds.bind(chunkManager);
    const tBounds = getTBounds();

    expect(tBounds).toHaveLength(2);
    expect(tBounds[0]).toBeLessThanOrEqual(tBounds[1]);

    // With t coordinate at 0.5 and chunk size 10, scale 0.1
    // Should be in first chunk (index 0): bounds [0, 1.0]
    expect(tBounds[0]).toBe(0.0);
    expect(tBounds[1]).toBe(1.0);
  });

  test("getTBounds handles missing t dimension", () => {
    const dimensionsWithoutT = { ...mockDimensions };
    delete dimensionsWithoutT.t;

    const loaderWithoutT = new MockChunkLoader(dimensionsWithoutT);
    const sliceCoordsWithoutT = { z: 2.5, c: 0 }; // No t coordinate

    const chunkManager = new ChunkManagerSource(
      loaderWithoutT,
      sliceCoordsWithoutT
    );
    const getTBounds = (
      chunkManager as unknown as { getTBounds: () => [number, number] }
    ).getTBounds.bind(chunkManager);
    const tBounds = getTBounds();

    // Should return default bounds when t dimension doesn't exist
    expect(tBounds).toEqual([0, 1]);
  });

  test("getTBounds handles missing t slice coordinate", () => {
    const sliceCoordsWithoutT = { z: 2.5, c: 0 }; // No t coordinate

    const chunkManager = new ChunkManagerSource(
      mockLoader,
      sliceCoordsWithoutT
    );
    const getTBounds = (
      chunkManager as unknown as { getTBounds: () => [number, number] }
    ).getTBounds.bind(chunkManager);
    const tBounds = getTBounds();

    // Should return default bounds when t slice coordinate is undefined
    expect(tBounds).toEqual([0, 1]);
  });

  test("tBoundsChanged detects temporal bounds changes", () => {
    const chunkManager = new ChunkManagerSource(mockLoader, sliceCoords);
    const tBoundsChanged = (
      chunkManager as unknown as {
        tBoundsChanged: (bounds: [number, number]) => boolean;
      }
    ).tBoundsChanged.bind(chunkManager);

    const bounds1: [number, number] = [0, 1];
    const bounds2: [number, number] = [1, 2];

    // First call should return true (no previous bounds)
    expect(tBoundsChanged(bounds1)).toBe(true);

    // Same bounds should return false
    expect(tBoundsChanged(bounds1)).toBe(false);

    // Different bounds should return true
    expect(tBoundsChanged(bounds2)).toBe(true);

    // Same new bounds should return false
    expect(tBoundsChanged(bounds2)).toBe(false);
  });

  test("isChunkWithinTimeBounds correctly identifies temporal visibility", () => {
    const chunkManager = new ChunkManagerSource(mockLoader, sliceCoords);
    const isChunkWithinTimeBounds = (
      chunkManager as unknown as {
        isChunkWithinTimeBounds: (
          chunk: Chunk,
          bounds: [number, number]
        ) => boolean;
      }
    ).isChunkWithinTimeBounds.bind(chunkManager);

    const chunk: Chunk = {
      data: undefined,
      state: "unloaded",
      lod: 0,
      visible: false,
      prefetch: false,
      priority: null,
      shape: { x: 50, y: 50, z: 5, c: 3, t: 10 },
      rowStride: 50,
      rowAlignmentBytes: 4,
      chunkIndex: { x: 0, y: 0, z: 0, t: 0 },
      scale: { x: 1.0, y: 1.0, z: 1.0, t: 0.1 },
      offset: { x: 0.0, y: 0.0, z: 0.0, t: 0.0 },
    };

    const timeBounds: [number, number] = [0.0, 1.0];

    // Chunk time range: [0.0, 1.0] should intersect with bounds [0.0, 1.0]
    expect(isChunkWithinTimeBounds(chunk, timeBounds)).toBe(true);

    // Chunk outside time bounds should not be visible
    chunk.offset.t = 2.0; // Chunk time range: [2.0, 3.0]
    expect(isChunkWithinTimeBounds(chunk, timeBounds)).toBe(false);

    // Partially overlapping should be visible
    chunk.offset.t = 0.5; // Chunk time range: [0.5, 1.5]
    expect(isChunkWithinTimeBounds(chunk, timeBounds)).toBe(true);
  });

  test("update method includes temporal bounds checking", () => {
    const chunkManager = new ChunkManagerSource(mockLoader, sliceCoords);

    // Mock the private methods to spy on them
    const getTBoundsSpy = vi
      .spyOn(
        chunkManager as unknown as { getTBounds: () => [number, number] },
        "getTBounds"
      )
      .mockReturnValue([0, 1]);
    const tBoundsChangedSpy = vi
      .spyOn(
        chunkManager as unknown as {
          tBoundsChanged: (bounds: [number, number]) => boolean;
        },
        "tBoundsChanged"
      )
      .mockReturnValue(true);
    const updateChunkVisibilitySpy = vi
      .spyOn(
        chunkManager as unknown as { updateChunkVisibility: () => void },
        "updateChunkVisibility"
      )
      .mockImplementation(() => {});

    const viewBounds = new Box2(
      vec2.fromValues(0, 0),
      vec2.fromValues(100, 100)
    );

    chunkManager.update(1.0, viewBounds);

    // Verify temporal bounds methods are called
    expect(getTBoundsSpy).toHaveBeenCalled();
    expect(tBoundsChangedSpy).toHaveBeenCalled();
    expect(updateChunkVisibilitySpy).toHaveBeenCalled();
  });

  test("4D chunk generation creates correct number of temporal chunks", () => {
    const chunkManager = new ChunkManagerSource(mockLoader, sliceCoords);
    const chunks = chunkManager.chunks;

    // For LOD 0:
    // - X: ceil(100/50) = 2 chunks
    // - Y: ceil(100/50) = 2 chunks
    // - Z: ceil(10/5) = 2 chunks
    // - T: ceil(20/10) = 2 chunks
    // Total for LOD 0: 2 * 2 * 2 * 2 = 16 chunks

    // For LOD 1:
    // - X: ceil(50/25) = 2 chunks
    // - Y: ceil(50/25) = 2 chunks
    // - Z: ceil(5/5) = 1 chunk
    // - T: ceil(10/5) = 2 chunks
    // Total for LOD 1: 2 * 2 * 1 * 2 = 8 chunks

    // Total: 16 + 8 = 24 chunks
    expect(chunks).toHaveLength(24);

    // Verify we have chunks with different t indices
    const tIndices = new Set(chunks.map((c) => c.chunkIndex.t));
    expect(tIndices.size).toBeGreaterThan(1);
    expect(tIndices.has(0)).toBe(true);
    expect(tIndices.has(1)).toBe(true);
  });

  test("temporal chunks have correct offset calculations", () => {
    const chunkManager = new ChunkManagerSource(mockLoader, sliceCoords);
    const chunks = chunkManager.chunks;

    // Find chunks with different t indices from LOD 0
    const lod0Chunks = chunks.filter((c) => c.lod === 0);
    const tChunk0 = lod0Chunks.find((c) => c.chunkIndex.t === 0);
    const tChunk1 = lod0Chunks.find((c) => c.chunkIndex.t === 1);

    expect(tChunk0).toBeDefined();
    expect(tChunk1).toBeDefined();

    // T chunk 0: offset = translation + 0 * chunkSize * scale = 0 + 0 * 10 * 0.1 = 0.0
    expect(tChunk0!.offset.t).toBe(0.0);

    // T chunk 1: offset = translation + 1 * chunkSize * scale = 0 + 1 * 10 * 0.1 = 1.0
    expect(tChunk1!.offset.t).toBe(1.0);

    // Both should have same shape and scale
    expect(tChunk0!.shape.t).toBe(10);
    expect(tChunk1!.shape.t).toBe(10);
    expect(tChunk0!.scale.t).toBe(0.1);
    expect(tChunk1!.scale.t).toBe(0.1);
  });
});
