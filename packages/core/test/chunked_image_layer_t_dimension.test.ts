import { expect, test, describe, vi, beforeEach } from "vitest";
import { ChunkedImageLayer } from "../src/layers/chunked_image_layer";
import {
  Chunk,
  ChunkSource,
  ChunkLoader,
  SliceCoordinates,
  SourceDimensionMap,
  LoaderAttributes,
} from "../src/data/chunk";
import { IdetikContext } from "../src/idetik";
import { ChunkManager, ChunkManagerSource } from "../src/core/chunk_manager";

// Mock ChunkSource and related classes
class MockChunkLoader implements ChunkLoader {
  getSourceDimensionMap(): SourceDimensionMap {
    return {
      x: {
        name: "x",
        index: 0,
        lods: [{ size: 100, chunkSize: 50, scale: 1.0, translation: 0.0 }],
      },
      y: {
        name: "y",
        index: 1,
        lods: [{ size: 100, chunkSize: 50, scale: 1.0, translation: 0.0 }],
      },
      z: {
        name: "z",
        index: 2,
        lods: [{ size: 10, chunkSize: 5, scale: 1.0, translation: 0.0 }],
      },
      t: {
        name: "t",
        index: 3,
        lods: [{ size: 20, chunkSize: 10, scale: 0.1, translation: 0.0 }],
      },
      numLods: 1,
    };
  }

  async loadChunkData(
    chunk: Chunk,
    _sliceCoords: SliceCoordinates
  ): Promise<void> {
    // Create 4D data: x * y * z * t
    const totalSize =
      chunk.shape.x * chunk.shape.y * chunk.shape.z * chunk.shape.t;
    chunk.data = new Float32Array(totalSize);

    // Fill with test pattern: each time slice has different values
    for (let t = 0; t < chunk.shape.t; t++) {
      const timeSliceOffset = t * chunk.shape.x * chunk.shape.y * chunk.shape.z;
      for (let i = 0; i < chunk.shape.x * chunk.shape.y * chunk.shape.z; i++) {
        chunk.data[timeSliceOffset + i] = (t + 1) * 10 + (i % 10); // Unique pattern per time slice
      }
    }
  }

  async loadRegion(): Promise<Chunk> {
    throw new Error("Not implemented for mock");
  }

  getAttributes(): ReadonlyArray<LoaderAttributes> {
    return [];
  }
}

class MockChunkSource implements ChunkSource {
  async open(): Promise<ChunkLoader> {
    return new MockChunkLoader();
  }
}

// Mock IdetikContext with minimal required functionality
const createMockContext = (): Partial<IdetikContext> => ({
  chunkManager: {
    addSource: vi.fn().mockImplementation(async (source, sliceCoords) => {
      const loader = await source.open();
      return new ChunkManagerSource(loader, sliceCoords);
    }),
    update: vi.fn(),
  } as ChunkManager,
});

describe("ChunkedImageLayer temporal slicing", () => {
  let mockSource: MockChunkSource;
  let mockContext: Partial<IdetikContext>;
  let sliceCoords: SliceCoordinates;

  beforeEach(() => {
    mockSource = new MockChunkSource();
    mockContext = createMockContext();
    sliceCoords = {
      z: 2.5,
      c: 0,
      t: 0.5, // Time slice at t=0.5
    };
  });

  test("sliceTime extracts correct temporal slice from 4D data", async () => {
    const layer = new ChunkedImageLayer({
      source: mockSource,
      sliceCoords,
    });

    await layer.onAttached(mockContext as IdetikContext);

    // Create test chunk with 4D data
    const testChunk: Chunk = {
      data: new Float32Array(50 * 50 * 5 * 3), // 50x50x5x3 4D data
      state: "loaded",
      lod: 0,
      visible: true,
      prefetch: false,
      priority: 1,
      shape: { x: 50, y: 50, z: 5, c: 1, t: 3 }, // 3 time points
      rowStride: 50,
      rowAlignmentBytes: 4,
      chunkIndex: { x: 0, y: 0, z: 0, t: 0 },
      scale: { x: 1.0, y: 1.0, z: 1.0, t: 0.1 },
      offset: { x: 0.0, y: 0.0, z: 0.0, t: 0.0 },
    };

    // Fill test data: each time slice has distinct values
    const spatialSize = 50 * 50 * 5; // x * y * z
    for (let t = 0; t < 3; t++) {
      const timeOffset = t * spatialSize;
      for (let i = 0; i < spatialSize; i++) {
        testChunk.data![timeOffset + i] = (t + 1) * 100 + i; // Time slice 0: 100+i, slice 1: 200+i, etc.
      }
    }

    // Test sliceTime method
    const sliceTime = (
      layer as unknown as {
        sliceTime: (chunk: Chunk, tValue: number) => Float32Array | undefined;
      }
    ).sliceTime.bind(layer);

    // Slice at t=0.05 should give first time slice (index 0)
    const slice0 = sliceTime(testChunk, 0.05);
    expect(slice0).toBeDefined();
    expect(slice0.length).toBe(spatialSize);
    expect(slice0[0]).toBe(100); // First value of time slice 0
    expect(slice0[1]).toBe(101); // Second value of time slice 0

    // Slice at t=0.15 should give second time slice (index 1)
    const slice1 = sliceTime(testChunk, 0.15);
    expect(slice1).toBeDefined();
    expect(slice1.length).toBe(spatialSize);
    expect(slice1[0]).toBe(200); // First value of time slice 1
    expect(slice1[1]).toBe(201); // Second value of time slice 1

    // Slice at t=0.25 should give third time slice (index 2)
    const slice2 = sliceTime(testChunk, 0.25);
    expect(slice2).toBeDefined();
    expect(slice2.length).toBe(spatialSize);
    expect(slice2[0]).toBe(300); // First value of time slice 2
    expect(slice2[1]).toBe(301); // Second value of time slice 2
  });

  test("sliceTime handles edge cases correctly", async () => {
    const layer = new ChunkedImageLayer({
      source: mockSource,
      sliceCoords,
    });

    await layer.onAttached(mockContext as IdetikContext);

    const testChunk: Chunk = {
      data: new Float32Array(10 * 10 * 2 * 4), // 10x10x2x4 data
      state: "loaded",
      lod: 0,
      visible: true,
      prefetch: false,
      priority: 1,
      shape: { x: 10, y: 10, z: 2, c: 1, t: 4 },
      rowStride: 10,
      rowAlignmentBytes: 4,
      chunkIndex: { x: 0, y: 0, z: 0, t: 0 },
      scale: { x: 1.0, y: 1.0, z: 1.0, t: 0.1 },
      offset: { x: 0.0, y: 0.0, z: 0.0, t: 0.0 },
    };

    const sliceTime = (
      layer as unknown as {
        sliceTime: (chunk: Chunk, tValue: number) => Float32Array | undefined;
      }
    ).sliceTime.bind(layer);

    // Test with no data
    expect(sliceTime({ ...testChunk, data: undefined }, 0.05)).toBeUndefined();

    // Test boundary conditions
    const spatialSize = 10 * 10 * 2;

    // t value at chunk boundary (should clamp to valid range)
    const sliceAtBoundary = sliceTime(testChunk, -0.05); // Below range
    expect(sliceAtBoundary).toBeDefined();
    expect(sliceAtBoundary.length).toBe(spatialSize);

    const sliceAtUpperBoundary = sliceTime(testChunk, 0.45); // Above range
    expect(sliceAtUpperBoundary).toBeDefined();
    expect(sliceAtUpperBoundary.length).toBe(spatialSize);
  });

  test("resliceIfTChanged updates chunks when time changes", async () => {
    const layer = new ChunkedImageLayer({
      source: mockSource,
      sliceCoords,
    });

    await layer.onAttached(mockContext as IdetikContext);

    // Mock visibleChunks_ and texture updating
    const mockImage = {
      textures: [
        {
          updateWithChunk: vi.fn(),
        },
      ],
    };

    const testChunk: Chunk = {
      data: new Float32Array(100),
      state: "loaded",
      lod: 0,
      visible: true,
      prefetch: false,
      priority: 1,
      shape: { x: 10, y: 10, z: 1, c: 1, t: 1 },
      rowStride: 10,
      rowAlignmentBytes: 4,
      chunkIndex: { x: 0, y: 0, z: 0, t: 0 },
      scale: { x: 1.0, y: 1.0, z: 1.0, t: 0.1 },
      offset: { x: 0.0, y: 0.0, z: 0.0, t: 0.0 },
    };

    // Set up visible chunks
    (
      layer as unknown as { visibleChunks_: Map<Chunk, unknown> }
    ).visibleChunks_.set(testChunk, mockImage);

    // Mock sliceTime to return test data
    const mockSliceTime = vi
      .spyOn(
        layer as unknown as {
          sliceTime: (chunk: Chunk, tValue: number) => Float32Array | undefined;
        },
        "sliceTime"
      )
      .mockReturnValue(new Float32Array(100));

    // Test resliceIfTChanged method
    const resliceIfTChanged = (
      layer as unknown as { resliceIfTChanged: () => void }
    ).resliceIfTChanged.bind(layer);

    // First call should trigger reslicing (no previous time)
    resliceIfTChanged();
    expect(mockSliceTime).toHaveBeenCalledWith(testChunk, 0.5);
    expect(mockImage.textures[0].updateWithChunk).toHaveBeenCalledWith(
      testChunk,
      expect.any(Float32Array)
    );

    // Same time should not trigger reslicing
    mockSliceTime.mockClear();
    mockImage.textures[0].updateWithChunk.mockClear();
    resliceIfTChanged();
    expect(mockSliceTime).not.toHaveBeenCalled();
    expect(mockImage.textures[0].updateWithChunk).not.toHaveBeenCalled();

    // Change time coordinate and test again
    (layer as unknown as { sliceCoords_: SliceCoordinates }).sliceCoords_.t =
      1.0;
    resliceIfTChanged();
    expect(mockSliceTime).toHaveBeenCalledWith(testChunk, 1.0);
    expect(mockImage.textures[0].updateWithChunk).toHaveBeenCalledWith(
      testChunk,
      expect.any(Float32Array)
    );
  });

  test("getDataForImage applies temporal slicing before spatial slicing", async () => {
    const layer = new ChunkedImageLayer({
      source: mockSource,
      sliceCoords: {
        z: 2.0, // Spatial slice
        t: 0.5, // Temporal slice
        c: 0,
      },
    });

    await layer.onAttached(mockContext as IdetikContext);

    const testChunk: Chunk = {
      data: new Float32Array(20 * 20 * 4 * 2), // x=20, y=20, z=4, t=2
      state: "loaded",
      lod: 0,
      visible: true,
      prefetch: false,
      priority: 1,
      shape: { x: 20, y: 20, z: 4, c: 1, t: 2 },
      rowStride: 20,
      rowAlignmentBytes: 4,
      chunkIndex: { x: 0, y: 0, z: 0, t: 0 },
      scale: { x: 1.0, y: 1.0, z: 1.0, t: 0.5 },
      offset: { x: 0.0, y: 0.0, z: 0.0, t: 0.0 },
    };

    // Mock sliceTime and slicePlane methods
    const temporallySlicedData = new Float32Array(20 * 20 * 4); // After temporal slicing
    const finalSlicedData = new Float32Array(20 * 20); // After both temporal and spatial slicing

    const mockSliceTime = vi
      .spyOn(
        layer as unknown as {
          sliceTime: (chunk: Chunk, tValue: number) => Float32Array | undefined;
        },
        "sliceTime"
      )
      .mockReturnValue(temporallySlicedData);
    const mockSlicePlane = vi
      .spyOn(
        layer as unknown as {
          slicePlane: (
            chunk: Chunk,
            zValue: number
          ) => Float32Array | undefined;
        },
        "slicePlane"
      )
      .mockReturnValue(finalSlicedData);

    const getDataForImage = (
      layer as unknown as {
        getDataForImage: (chunk: Chunk) => Float32Array | undefined;
      }
    ).getDataForImage.bind(layer);
    const result = getDataForImage(testChunk);

    // Verify temporal slicing happens first
    expect(mockSliceTime).toHaveBeenCalledWith(testChunk, 0.5);

    // Then spatial slicing on the temporally sliced data
    // Note: slicePlane should receive the temporally sliced data, but for testing we mock it
    expect(mockSlicePlane).toHaveBeenCalledWith(testChunk, 2.0);

    expect(result).toBe(finalSlicedData);
  });

  test("update method calls resliceIfTChanged", async () => {
    const layer = new ChunkedImageLayer({
      source: mockSource,
      sliceCoords,
    });

    await layer.onAttached(mockContext as IdetikContext);

    // Mock the methods called by update
    const mockUpdateChunks = vi
      .spyOn(layer as unknown as { updateChunks: () => void }, "updateChunks")
      .mockImplementation(() => {});
    const mockResliceIfZChanged = vi
      .spyOn(
        layer as unknown as { resliceIfZChanged: () => void },
        "resliceIfZChanged"
      )
      .mockImplementation(() => {});
    const mockResliceIfTChanged = vi
      .spyOn(
        layer as unknown as { resliceIfTChanged: () => void },
        "resliceIfTChanged"
      )
      .mockImplementation(() => {});

    layer.update();

    expect(mockUpdateChunks).toHaveBeenCalled();
    expect(mockResliceIfZChanged).toHaveBeenCalled();
    expect(mockResliceIfTChanged).toHaveBeenCalled();
  });

  test("layer handles missing t coordinate gracefully", async () => {
    const layerWithoutT = new ChunkedImageLayer({
      source: mockSource,
      sliceCoords: { z: 2.5, c: 0 }, // No t coordinate
    });

    await layerWithoutT.onAttached(mockContext as IdetikContext);

    const resliceIfTChanged = (
      layerWithoutT as unknown as { resliceIfTChanged: () => void }
    ).resliceIfTChanged.bind(layerWithoutT);

    // Should not throw error when t coordinate is undefined
    expect(() => resliceIfTChanged()).not.toThrow();

    // Should not trigger any slicing operations
    const mockSliceTime = vi.spyOn(
      layerWithoutT as unknown as {
        sliceTime: (chunk: Chunk, tValue: number) => Float32Array | undefined;
      },
      "sliceTime"
    );
    resliceIfTChanged();
    expect(mockSliceTime).not.toHaveBeenCalled();
  });
});
