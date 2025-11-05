import { describe, expect, test } from "vitest";
import { ChunkStatistics } from "@/core/chunk_statistics";
import { makeChunk } from "./helpers";

describe("ChunkStatistics", () => {
  test("initializes with zero counts", () => {
    const statistics = new ChunkStatistics();
    const stats = statistics.getStats(0, 0);

    expect(stats.total).toBe(0);
    expect(stats.unloaded).toBe(0);
    expect(stats.queued).toBe(0);
    expect(stats.loading).toBe(0);
    expect(stats.loaded).toBe(0);
    expect(stats.visible).toBe(0);
    expect(stats.prefetch).toBe(0);
  });

  test("tracks chunk and initializes counts", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 0,
    });

    statistics.trackChunk(chunk);

    const stats = statistics.getStats(0, 0);
    expect(stats.total).toBe(1);
    expect(stats.unloaded).toBe(1);
  });

  test("tracks multiple chunks at same (time, LOD)", () => {
    const statistics = new ChunkStatistics();

    for (let i = 0; i < 10; i++) {
      const chunk = makeChunk({
        state: "unloaded",
        chunkIndex: { t: 0, x: i },
        lod: 0,
      });
      statistics.trackChunk(chunk);
    }

    const stats = statistics.getStats(0, 0);
    expect(stats.total).toBe(10);
    expect(stats.unloaded).toBe(10);
  });

  test("tracks chunks at different time indices", () => {
    const statistics = new ChunkStatistics();

    for (let t = 0; t < 5; t++) {
      for (let i = 0; i < 3; i++) {
        const chunk = makeChunk({
          state: "unloaded",
          chunkIndex: { t, x: i },
          lod: 0,
        });
        statistics.trackChunk(chunk);
      }
    }

    for (let t = 0; t < 5; t++) {
      const stats = statistics.getStats(t, 0);
      expect(stats.total).toBe(3);
      expect(stats.unloaded).toBe(3);
    }
  });

  test("tracks chunks at different LODs", () => {
    const statistics = new ChunkStatistics();

    for (let lod = 0; lod < 3; lod++) {
      for (let i = 0; i < lod + 1; i++) {
        const chunk = makeChunk({
          state: "unloaded",
          chunkIndex: { t: 0, x: i },
          lod,
        });
        statistics.trackChunk(chunk);
      }
    }

    expect(statistics.getStats(0, 0).total).toBe(1);
    expect(statistics.getStats(0, 1).total).toBe(2);
    expect(statistics.getStats(0, 2).total).toBe(3);
  });

  test("automatically observes state transition from unloaded to queued", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 0,
    });

    statistics.trackChunk(chunk);
    chunk.state = "queued";

    const stats = statistics.getStats(0, 0);
    expect(stats.unloaded).toBe(0);
    expect(stats.queued).toBe(1);
  });

  test("automatically observes state transition from queued to loading", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 0,
    });

    statistics.trackChunk(chunk);
    chunk.state = "queued";
    chunk.state = "loading";

    const stats = statistics.getStats(0, 0);
    expect(stats.queued).toBe(0);
    expect(stats.loading).toBe(1);
  });

  test("automatically observes state transition from loading to loaded", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 0,
    });

    statistics.trackChunk(chunk);
    chunk.state = "queued";
    chunk.state = "loading";
    chunk.state = "loaded";

    const stats = statistics.getStats(0, 0);
    expect(stats.loading).toBe(0);
    expect(stats.loaded).toBe(1);
  });

  test("automatically observes state transition from loading to unloaded on error", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 0,
    });

    statistics.trackChunk(chunk);
    chunk.state = "queued";
    chunk.state = "loading";
    chunk.state = "unloaded";

    const stats = statistics.getStats(0, 0);
    expect(stats.loading).toBe(0);
    expect(stats.unloaded).toBe(1);
  });

  test("ignores state change to same state", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 0,
    });

    statistics.trackChunk(chunk);
    const beforeCount = statistics.getStats(0, 0).unloaded;

    chunk.state = "unloaded"; // No change

    const afterCount = statistics.getStats(0, 0).unloaded;
    expect(afterCount).toBe(beforeCount);
  });

  test("automatically observes visibility change to true", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 1,
      visible: false,
    });

    statistics.trackChunk(chunk);
    chunk.visible = true;

    const stats = statistics.getStats(0, 1);
    expect(stats.visible).toBe(1);
  });

  test("automatically observes visibility change to false", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 1,
      visible: false,
    });

    statistics.trackChunk(chunk);
    chunk.visible = true;
    chunk.visible = false;

    const stats = statistics.getStats(0, 1);
    expect(stats.visible).toBe(0);
  });

  test("tracks visibility across multiple LODs", () => {
    const statistics = new ChunkStatistics();

    for (let lod = 0; lod < 3; lod++) {
      for (let i = 0; i < lod + 1; i++) {
        const chunk = makeChunk({
          state: "unloaded",
          chunkIndex: { t: 0, x: i },
          lod,
          visible: false,
        });
        statistics.trackChunk(chunk);
        chunk.visible = true;
      }
    }

    expect(statistics.getStats(0, 0).visible).toBe(1);
    expect(statistics.getStats(0, 1).visible).toBe(2);
    expect(statistics.getStats(0, 2).visible).toBe(3);
  });

  test("automatically observes prefetch change to true", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 1,
      prefetch: false,
    });

    statistics.trackChunk(chunk);
    chunk.prefetch = true;

    const stats = statistics.getStats(0, 1);
    expect(stats.prefetch).toBe(1);
  });

  test("automatically observes prefetch change to false", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 1,
      prefetch: false,
    });

    statistics.trackChunk(chunk);
    chunk.prefetch = true;
    chunk.prefetch = false;

    const stats = statistics.getStats(0, 1);
    expect(stats.prefetch).toBe(0);
  });

  test("untracks chunk and removes counts", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({
      state: "loaded",
      chunkIndex: { t: 0 },
      lod: 0,
      visible: true,
      prefetch: false,
    });

    statistics.trackChunk(chunk);
    statistics.untrackChunk(chunk);

    const stats = statistics.getStats(0, 0);
    expect(stats.total).toBe(0);
    expect(stats.loaded).toBe(0);
    expect(stats.visible).toBe(0);
  });

  test("returns empty stats for non-existent (time, LOD)", () => {
    const statistics = new ChunkStatistics();
    const stats = statistics.getStats(999, 5);

    expect(stats.total).toBe(0);
    expect(stats.unloaded).toBe(0);
    expect(stats.queued).toBe(0);
    expect(stats.loading).toBe(0);
    expect(stats.loaded).toBe(0);
    expect(stats.visible).toBe(0);
    expect(stats.prefetch).toBe(0);
  });

  test("tracks multiple time indices independently", () => {
    const statistics = new ChunkStatistics();

    // Time 0: 3 chunks, all unloaded
    for (let i = 0; i < 3; i++) {
      const chunk = makeChunk({
        state: "unloaded",
        chunkIndex: { t: 0, x: i },
        lod: 0,
      });
      statistics.trackChunk(chunk);
    }

    // Time 1: 2 chunks, transition to queued
    const time1Chunks = [];
    for (let i = 0; i < 2; i++) {
      const chunk = makeChunk({
        state: "unloaded",
        chunkIndex: { t: 1, x: i },
        lod: 0,
      });
      statistics.trackChunk(chunk);
      time1Chunks.push(chunk);
    }
    time1Chunks.forEach((chunk) => (chunk.state = "queued"));

    const time0Stats = statistics.getStats(0, 0);
    expect(time0Stats.total).toBe(3);
    expect(time0Stats.unloaded).toBe(3);
    expect(time0Stats.queued).toBe(0);

    const time1Stats = statistics.getStats(1, 0);
    expect(time1Stats.total).toBe(2);
    expect(time1Stats.unloaded).toBe(0);
    expect(time1Stats.queued).toBe(2);
  });

  test("complex scenario with multiple state changes", () => {
    const statistics = new ChunkStatistics();

    // Create 10 chunks at time 0, LOD 0
    const chunks = [];
    for (let i = 0; i < 10; i++) {
      const chunk = makeChunk({
        state: "unloaded",
        chunkIndex: { t: 0, x: i },
        lod: 0,
      });
      statistics.trackChunk(chunk);
      chunks.push(chunk);
    }

    // Make 5 visible
    for (let i = 0; i < 5; i++) {
      chunks[i].visible = true;
    }

    // Queue 3 chunks
    for (let i = 0; i < 3; i++) {
      chunks[i].state = "queued";
    }

    // Start loading 2 chunks
    for (let i = 0; i < 2; i++) {
      chunks[i].state = "loading";
    }

    // Complete loading 1 chunk
    chunks[0].state = "loaded";

    // Make 3 chunks prefetched
    for (let i = 5; i < 8; i++) {
      chunks[i].prefetch = true;
    }

    const stats = statistics.getStats(0, 0);
    expect(stats.total).toBe(10);
    expect(stats.unloaded).toBe(7); // 10 - 1 loaded - 1 loading - 1 queued
    expect(stats.queued).toBe(1);
    expect(stats.loading).toBe(1);
    expect(stats.loaded).toBe(1);
    expect(stats.visible).toBe(5);
    expect(stats.prefetch).toBe(3);
  });

  test("tracks chunks with initial visible/prefetch state", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 0,
      visible: true,
      prefetch: true,
    });

    statistics.trackChunk(chunk);

    const stats = statistics.getStats(0, 0);
    expect(stats.visible).toBe(1);
    expect(stats.prefetch).toBe(1);
  });
});
