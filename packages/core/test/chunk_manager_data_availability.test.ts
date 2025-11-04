import { expect, test, describe } from "vitest";
import { ChunkManagerDataAvailability } from "@";
import { Box3 } from "@/math/box3";
import { vec3 } from "gl-matrix";
import type { Chunk } from "@/data/chunk";

// Interface matching ChunkManagerSource public API needed by ChunkManagerDataAvailability
interface ChunkManagerSourceLike {
  areChunksLoadedAtTimeIndex(timeIndex: number, lod: number): boolean;
  readonly lastViewBounds3D: Box3 | null;
  readonly timeSize: number;
  readonly lowestResLOD: number;
}

// Mock ChunkManagerSource for testing
class MockChunkManagerSource implements ChunkManagerSourceLike {
  private chunks_: Chunk[][] = [];
  private lastViewBounds3D_: Box3 | null = null;
  private lowestResLOD_: number = 1;

  constructor(timeSize: number, chunksPerTime: Chunk[]) {
    // Create chunks for each time point
    for (let t = 0; t < timeSize; t++) {
      this.chunks_[t] = chunksPerTime.map((chunk) => ({
        ...chunk,
        chunkIndex: { ...chunk.chunkIndex, t },
      }));
    }
  }

  setViewBounds(bounds: Box3) {
    this.lastViewBounds3D_ = bounds;
  }

  setChunkState(timeIndex: number, chunkIndex: number, state: Chunk["state"]) {
    if (
      timeIndex >= 0 &&
      timeIndex < this.chunks_.length &&
      chunkIndex >= 0 &&
      chunkIndex < this.chunks_[timeIndex].length
    ) {
      this.chunks_[timeIndex][chunkIndex].state = state;
    }
  }

  areChunksLoadedAtTimeIndex(timeIndex: number, lod: number): boolean {
    if (timeIndex < 0 || timeIndex >= this.chunks_.length) {
      return false;
    }

    if (this.lastViewBounds3D_ === null) {
      return false;
    }

    const chunks = this.chunks_[timeIndex];
    const requiredChunks = chunks.filter((chunk) => {
      if (chunk.lod !== lod) return false;

      // Simple bounds check
      const chunkBounds = new Box3(
        vec3.fromValues(chunk.offset.x, chunk.offset.y, chunk.offset.z),
        vec3.fromValues(
          chunk.offset.x + chunk.shape.x * chunk.scale.x,
          chunk.offset.y + chunk.shape.y * chunk.scale.y,
          chunk.offset.z + chunk.shape.z * chunk.scale.z
        )
      );
      return Box3.intersects(chunkBounds, this.lastViewBounds3D_!);
    });

    if (requiredChunks.length === 0) {
      return true;
    }

    return requiredChunks.every((chunk) => chunk.state === "loaded");
  }

  get lastViewBounds3D(): Box3 | null {
    return this.lastViewBounds3D_;
  }

  get timeSize(): number {
    return this.chunks_.length;
  }

  get lowestResLOD(): number {
    return this.lowestResLOD_;
  }
}

describe("ChunkManagerDataAvailability", () => {
  test("isLoaded returns false when no view bounds set", () => {
    const mockChunks: Chunk[] = [
      {
        state: "loaded",
        lod: 1,
        visible: false,
        prefetch: false,
        priority: null,
        orderKey: null,
        shape: { x: 256, y: 256, z: 1, c: 1 },
        rowAlignmentBytes: 1,
        chunkIndex: { x: 0, y: 0, z: 0, c: 0, t: 0 },
        scale: { x: 1, y: 1, z: 1 },
        offset: { x: 0, y: 0, z: 0 },
      },
    ];

    const mockSource = new MockChunkManagerSource(5, mockChunks);
    const dataAvailability = new ChunkManagerDataAvailability(
      mockSource as unknown as ChunkManagerSourceLike & { lowestResLOD: number }
    );

    expect(dataAvailability.isLoaded(0)).toBe(false);
  });

  test("isLoaded returns true when all required chunks are loaded", () => {
    const mockChunks: Chunk[] = [
      {
        state: "loaded",
        lod: 1,
        visible: false,
        prefetch: false,
        priority: null,
        orderKey: null,
        shape: { x: 256, y: 256, z: 1, c: 1 },
        rowAlignmentBytes: 1,
        chunkIndex: { x: 0, y: 0, z: 0, c: 0, t: 0 },
        scale: { x: 1, y: 1, z: 1 },
        offset: { x: 0, y: 0, z: 0 },
      },
    ];

    const mockSource = new MockChunkManagerSource(5, mockChunks);
    mockSource.setViewBounds(
      new Box3(vec3.fromValues(0, 0, 0), vec3.fromValues(256, 256, 1))
    );

    const dataAvailability = new ChunkManagerDataAvailability(
      mockSource as unknown as ChunkManagerSourceLike & { lowestResLOD: number }
    );

    expect(dataAvailability.isLoaded(0)).toBe(true);
    expect(dataAvailability.isLoaded(1)).toBe(true);
  });

  test("isLoaded returns false when some required chunks are not loaded", () => {
    const mockChunks: Chunk[] = [
      {
        state: "loaded",
        lod: 1,
        visible: false,
        prefetch: false,
        priority: null,
        orderKey: null,
        shape: { x: 256, y: 256, z: 1, c: 1 },
        rowAlignmentBytes: 1,
        chunkIndex: { x: 0, y: 0, z: 0, c: 0, t: 0 },
        scale: { x: 1, y: 1, z: 1 },
        offset: { x: 0, y: 0, z: 0 },
      },
      {
        state: "unloaded",
        lod: 1,
        visible: false,
        prefetch: false,
        priority: null,
        orderKey: null,
        shape: { x: 256, y: 256, z: 1, c: 1 },
        rowAlignmentBytes: 1,
        chunkIndex: { x: 1, y: 0, z: 0, c: 0, t: 0 },
        scale: { x: 1, y: 1, z: 1 },
        offset: { x: 256, y: 0, z: 0 },
      },
    ];

    const mockSource = new MockChunkManagerSource(5, mockChunks);
    mockSource.setViewBounds(
      new Box3(vec3.fromValues(0, 0, 0), vec3.fromValues(512, 256, 1))
    );

    const dataAvailability = new ChunkManagerDataAvailability(
      mockSource as unknown as ChunkManagerSourceLike & { lowestResLOD: number }
    );

    expect(dataAvailability.isLoaded(0)).toBe(false);
  });

  test("getLoadedAheadOf returns count of contiguous loaded indices", () => {
    const mockChunks: Chunk[] = [
      {
        state: "loaded",
        lod: 1,
        visible: false,
        prefetch: false,
        priority: null,
        orderKey: null,
        shape: { x: 256, y: 256, z: 1, c: 1 },
        rowAlignmentBytes: 1,
        chunkIndex: { x: 0, y: 0, z: 0, c: 0, t: 0 },
        scale: { x: 1, y: 1, z: 1 },
        offset: { x: 0, y: 0, z: 0 },
      },
    ];

    const mockSource = new MockChunkManagerSource(10, mockChunks);
    mockSource.setViewBounds(
      new Box3(vec3.fromValues(0, 0, 0), vec3.fromValues(256, 256, 1))
    );

    // Mark time indices 1, 2, 3 as loaded, but not 4
    mockSource.setChunkState(1, 0, "loaded");
    mockSource.setChunkState(2, 0, "loaded");
    mockSource.setChunkState(3, 0, "loaded");
    mockSource.setChunkState(4, 0, "unloaded");

    const dataAvailability = new ChunkManagerDataAvailability(
      mockSource as unknown as ChunkManagerSourceLike & { lowestResLOD: number }
    );

    // From position 0, should have 3 contiguous loaded ahead (1, 2, 3)
    expect(dataAvailability.getLoadedAheadOf(0)).toBe(3);
  });

  test("getLoadedAheadOf returns 0 when next index is not loaded", () => {
    const mockChunks: Chunk[] = [
      {
        state: "loaded",
        lod: 1,
        visible: false,
        prefetch: false,
        priority: null,
        orderKey: null,
        shape: { x: 256, y: 256, z: 1, c: 1 },
        rowAlignmentBytes: 1,
        chunkIndex: { x: 0, y: 0, z: 0, c: 0, t: 0 },
        scale: { x: 1, y: 1, z: 1 },
        offset: { x: 0, y: 0, z: 0 },
      },
    ];

    const mockSource = new MockChunkManagerSource(10, mockChunks);
    mockSource.setViewBounds(
      new Box3(vec3.fromValues(0, 0, 0), vec3.fromValues(256, 256, 1))
    );

    // Mark time index 0 as loaded, but not 1
    mockSource.setChunkState(0, 0, "loaded");
    mockSource.setChunkState(1, 0, "unloaded");

    const dataAvailability = new ChunkManagerDataAvailability(
      mockSource as unknown as ChunkManagerSourceLike & { lowestResLOD: number }
    );

    expect(dataAvailability.getLoadedAheadOf(0)).toBe(0);
  });

  test("getLoadedAheadOf stops at first non-loaded index", () => {
    const mockChunks: Chunk[] = [
      {
        state: "loaded",
        lod: 1,
        visible: false,
        prefetch: false,
        priority: null,
        orderKey: null,
        shape: { x: 256, y: 256, z: 1, c: 1 },
        rowAlignmentBytes: 1,
        chunkIndex: { x: 0, y: 0, z: 0, c: 0, t: 0 },
        scale: { x: 1, y: 1, z: 1 },
        offset: { x: 0, y: 0, z: 0 },
      },
    ];

    const mockSource = new MockChunkManagerSource(10, mockChunks);
    mockSource.setViewBounds(
      new Box3(vec3.fromValues(0, 0, 0), vec3.fromValues(256, 256, 1))
    );

    // Mark 1, 2 loaded, 3 not loaded, 4, 5 loaded
    mockSource.setChunkState(1, 0, "loaded");
    mockSource.setChunkState(2, 0, "loaded");
    mockSource.setChunkState(3, 0, "unloaded");
    mockSource.setChunkState(4, 0, "loaded");
    mockSource.setChunkState(5, 0, "loaded");

    const dataAvailability = new ChunkManagerDataAvailability(
      mockSource as unknown as ChunkManagerSourceLike & { lowestResLOD: number }
    );

    // Should stop at index 3, only counting 1 and 2
    expect(dataAvailability.getLoadedAheadOf(0)).toBe(2);
  });

  test("setLOD updates the LOD to check", () => {
    const mockChunks: Chunk[] = [
      {
        state: "loaded",
        lod: 0,
        visible: false,
        prefetch: false,
        priority: null,
        orderKey: null,
        shape: { x: 256, y: 256, z: 1, c: 1 },
        rowAlignmentBytes: 1,
        chunkIndex: { x: 0, y: 0, z: 0, c: 0, t: 0 },
        scale: { x: 1, y: 1, z: 1 },
        offset: { x: 0, y: 0, z: 0 },
      },
      {
        state: "unloaded",
        lod: 1,
        visible: false,
        prefetch: false,
        priority: null,
        orderKey: null,
        shape: { x: 128, y: 128, z: 1, c: 1 },
        rowAlignmentBytes: 1,
        chunkIndex: { x: 0, y: 0, z: 0, c: 0, t: 0 },
        scale: { x: 2, y: 2, z: 1 },
        offset: { x: 0, y: 0, z: 0 },
      },
    ];

    const mockSource = new MockChunkManagerSource(5, mockChunks);
    mockSource.setViewBounds(
      new Box3(vec3.fromValues(0, 0, 0), vec3.fromValues(256, 256, 1))
    );

    const dataAvailability = new ChunkManagerDataAvailability(
      mockSource as unknown as ChunkManagerSourceLike & {
        lowestResLOD: number;
      },
      1
    );

    // At LOD 1, chunks are not loaded
    expect(dataAvailability.isLoaded(0)).toBe(false);

    // Change to LOD 0
    dataAvailability.setLOD(0);
    expect(dataAvailability.lod).toBe(0);

    // At LOD 0, chunks are loaded
    expect(dataAvailability.isLoaded(0)).toBe(true);
  });
});
