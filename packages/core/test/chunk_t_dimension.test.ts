import { expect, test, describe } from "vitest";
import { Chunk } from "../src/data/chunk";

describe("Chunk type with t dimension", () => {
  test("chunk with t dimension has all required properties", () => {
    const chunk: Chunk = {
      data: new Float32Array([1, 2, 3, 4]),
      state: "loaded",
      lod: 0,
      visible: true,
      prefetch: false,
      priority: 1,
      shape: {
        x: 10,
        y: 10,
        z: 5,
        c: 1,
        t: 3, // Time dimension
      },
      rowStride: 10,
      rowAlignmentBytes: 4,
      chunkIndex: {
        x: 0,
        y: 0,
        z: 0,
        t: 1, // Time chunk index
      },
      scale: {
        x: 1.0,
        y: 1.0,
        z: 2.0,
        t: 0.5, // Time scale
      },
      offset: {
        x: 0.0,
        y: 0.0,
        z: 10.0,
        t: 5.0, // Time offset
      },
    };

    // Verify all properties exist and have expected values
    expect(chunk.shape.t).toBe(3);
    expect(chunk.chunkIndex.t).toBe(1);
    expect(chunk.scale.t).toBe(0.5);
    expect(chunk.offset.t).toBe(5.0);
  });

  test("chunk can represent 4D spatiotemporal data", () => {
    const spatioTemporalChunk: Chunk = {
      data: new Uint16Array(100 * 100 * 10 * 5), // x=100, y=100, z=10, t=5
      state: "loaded",
      lod: 1,
      visible: true,
      prefetch: false,
      priority: 0,
      shape: {
        x: 100, // Width
        y: 100, // Height  
        z: 10,  // Depth
        c: 1,   // Channels
        t: 5,   // Time points
      },
      rowStride: 100,
      rowAlignmentBytes: 2,
      chunkIndex: {
        x: 2,
        y: 3,
        z: 1,
        t: 0, // First time chunk
      },
      scale: {
        x: 2.0,  // 2x downsampled in x
        y: 2.0,  // 2x downsampled in y
        z: 1.0,  // No z downsampling
        t: 1.0,  // No temporal downsampling
      },
      offset: {
        x: 200.0, // World position
        y: 300.0, // World position
        z: 10.0,  // World position
        t: 0.0,   // Time position (first time point)
      },
    };

    expect(spatioTemporalChunk.data?.length).toBe(100 * 100 * 10 * 5);
    expect(spatioTemporalChunk.shape.t).toBe(5);
    expect(spatioTemporalChunk.chunkIndex.t).toBe(0);
    expect(spatioTemporalChunk.scale.t).toBe(1.0);
    expect(spatioTemporalChunk.offset.t).toBe(0.0);
  });

  test("chunk supports temporal chunking at different time indices", () => {
    const timeChunk2: Chunk = {
      data: undefined, // Not loaded yet
      state: "queued",
      lod: 0,
      visible: false,
      prefetch: true,
      priority: 3,
      shape: {
        x: 50,
        y: 50,
        z: 1,
        c: 2,
        t: 10, // Large temporal chunk
      },
      rowStride: 50,
      rowAlignmentBytes: 1,
      chunkIndex: {
        x: 0,
        y: 0,
        z: 0,
        t: 2, // Third time chunk (t=2)
      },
      scale: {
        x: 1.0,
        y: 1.0,
        z: 1.0,
        t: 0.1, // High temporal resolution
      },
      offset: {
        x: 0.0,
        y: 0.0,
        z: 0.0,
        t: 20.0, // Time offset for chunk t=2
      },
    };

    expect(timeChunk2.chunkIndex.t).toBe(2);
    expect(timeChunk2.shape.t).toBe(10);
    expect(timeChunk2.scale.t).toBe(0.1);
    expect(timeChunk2.offset.t).toBe(20.0);
  });

  test("chunk maintains backward compatibility when t dimension is zero", () => {
    const legacyChunk: Chunk = {
      data: new Float32Array([1, 2, 3, 4]),
      state: "loaded",
      lod: 0,
      visible: true,
      prefetch: false,
      priority: 1,
      shape: {
        x: 2,
        y: 2,
        z: 1,
        c: 1,
        t: 0, // No time dimension (backward compatibility)
      },
      rowStride: 2,
      rowAlignmentBytes: 4,
      chunkIndex: {
        x: 0,
        y: 0,
        z: 0,
        t: 0, // No time chunking
      },
      scale: {
        x: 1.0,
        y: 1.0,
        z: 1.0,
        t: 1.0, // Default scale
      },
      offset: {
        x: 0.0,
        y: 0.0,
        z: 0.0,
        t: 0.0, // No time offset
      },
    };

    expect(legacyChunk.shape.t).toBe(0);
    expect(legacyChunk.chunkIndex.t).toBe(0);
    expect(legacyChunk.scale.t).toBe(1.0);
    expect(legacyChunk.offset.t).toBe(0.0);
  });
});