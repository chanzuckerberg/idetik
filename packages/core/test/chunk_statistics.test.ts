import { describe, expect, test } from "vitest";
import { ChunkStatistics } from "@/core/chunk_statistics";
import { makeChunk } from "./helpers";

describe("ChunkStatistics", () => {
  test("initializes with zero counts", () => {
    const statistics = new ChunkStatistics();
    const stats = statistics.getStats(0, 0);

    expect(stats.totalChunks).toBe(0);
    expect(stats.unloadedChunks).toBe(0);
    expect(stats.queuedChunks).toBe(0);
    expect(stats.loadingChunks).toBe(0);
    expect(stats.loadedChunks).toBe(0);
    expect(stats.visibleChunks).toBe(0);
    expect(stats.prefetchedChunks).toBe(0);
  });

  test("tracks chunk and initializes counts", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 0 }, lod: 0 });

    statistics.trackChunk(chunk);

    const stats = statistics.getStats(0, 0);
    expect(stats.totalChunks).toBe(1);
    expect(stats.unloadedChunks).toBe(1);
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
    expect(stats.totalChunks).toBe(10);
    expect(stats.unloadedChunks).toBe(10);
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
      expect(stats.totalChunks).toBe(3);
      expect(stats.unloadedChunks).toBe(3);
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

    expect(statistics.getStats(0, 0).totalChunks).toBe(1);
    expect(statistics.getStats(0, 1).totalChunks).toBe(2);
    expect(statistics.getStats(0, 2).totalChunks).toBe(3);
  });

  test("automatically observes state transition from unloaded to queued", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 0 }, lod: 0 });

    statistics.trackChunk(chunk);
    chunk.state = "queued";

    const stats = statistics.getStats(0, 0);
    expect(stats.unloadedChunks).toBe(0);
    expect(stats.queuedChunks).toBe(1);
  });

  test("automatically observes state transition from queued to loading", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 0 }, lod: 0 });

    statistics.trackChunk(chunk);
    chunk.state = "queued";
    chunk.state = "loading";

    const stats = statistics.getStats(0, 0);
    expect(stats.queuedChunks).toBe(0);
    expect(stats.loadingChunks).toBe(1);
  });

  test("automatically observes state transition from loading to loaded", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 0 }, lod: 0 });

    statistics.trackChunk(chunk);
    chunk.state = "queued";
    chunk.state = "loading";
    chunk.state = "loaded";

    const stats = statistics.getStats(0, 0);
    expect(stats.loadingChunks).toBe(0);
    expect(stats.loadedChunks).toBe(1);
  });

  test("automatically observes state transition from loading to unloaded on error", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 0 }, lod: 0 });

    statistics.trackChunk(chunk);
    chunk.state = "queued";
    chunk.state = "loading";
    chunk.state = "unloaded";

    const stats = statistics.getStats(0, 0);
    expect(stats.loadingChunks).toBe(0);
    expect(stats.unloadedChunks).toBe(1);
  });

  test("ignores state change to same state", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 0 }, lod: 0 });

    statistics.trackChunk(chunk);
    const beforeCount = statistics.getStats(0, 0).unloadedChunks;

    chunk.state = "unloaded"; // No change

    const afterCount = statistics.getStats(0, 0).unloadedChunks;
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
    expect(stats.visibleChunks).toBe(1);
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
    expect(stats.visibleChunks).toBe(0);
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

    expect(statistics.getStats(0, 0).visibleChunks).toBe(1);
    expect(statistics.getStats(0, 1).visibleChunks).toBe(2);
    expect(statistics.getStats(0, 2).visibleChunks).toBe(3);
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
    expect(stats.prefetchedChunks).toBe(1);
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
    expect(stats.prefetchedChunks).toBe(0);
  });

  test("automatically observes LOD change", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({
      state: "loaded",
      chunkIndex: { t: 0 },
      lod: 0,
      visible: true,
      prefetch: false,
    });

    statistics.trackChunk(chunk);

    // Change LOD from 0 to 1
    chunk.lod = 1;

    const stats0 = statistics.getStats(0, 0);
    const stats1 = statistics.getStats(0, 1);

    expect(stats0.totalChunks).toBe(0);
    expect(stats0.loadedChunks).toBe(0);
    expect(stats0.visibleChunks).toBe(0);

    expect(stats1.totalChunks).toBe(1);
    expect(stats1.loadedChunks).toBe(1);
    expect(stats1.visibleChunks).toBe(1);
  });

  test("ignores LOD change to same LOD", () => {
    const statistics = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 0,
      visible: true,
    });

    statistics.trackChunk(chunk);
    const beforeCount = statistics.getStats(0, 0).totalChunks;

    chunk.lod = 0; // No change

    const afterCount = statistics.getStats(0, 0).totalChunks;
    expect(afterCount).toBe(beforeCount);
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
    expect(stats.totalChunks).toBe(0);
    expect(stats.loadedChunks).toBe(0);
    expect(stats.visibleChunks).toBe(0);
  });

  test("disposes time index", () => {
    const statistics = new ChunkStatistics();

    for (let i = 0; i < 5; i++) {
      const chunk = makeChunk({
        state: "unloaded",
        chunkIndex: { t: 0, x: i },
        lod: 0,
      });
      statistics.trackChunk(chunk);
    }

    const beforeStats = statistics.getStats(0, 0);
    expect(beforeStats.totalChunks).toBe(5);

    statistics.disposeTimeIndex(0);

    const afterStats = statistics.getStats(0, 0);
    expect(afterStats.totalChunks).toBe(0);
    expect(afterStats.unloadedChunks).toBe(0);
  });

  test("returns empty stats for non-existent (time, LOD)", () => {
    const statistics = new ChunkStatistics();
    const stats = statistics.getStats(999, 5);

    expect(stats.totalChunks).toBe(0);
    expect(stats.unloadedChunks).toBe(0);
    expect(stats.queuedChunks).toBe(0);
    expect(stats.loadingChunks).toBe(0);
    expect(stats.loadedChunks).toBe(0);
    expect(stats.visibleChunks).toBe(0);
    expect(stats.prefetchedChunks).toBe(0);
  });

  test("tracks multiple time indices independently", () => {
    const statistics = new ChunkStatistics();

    // Time 0: 3 chunks, all unloaded
    for (let i = 0; i < 3; i++) {
      const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 0, x: i }, lod: 0 });
      statistics.trackChunk(chunk);
    }

    // Time 1: 2 chunks, transition to queued
    const time1Chunks = [];
    for (let i = 0; i < 2; i++) {
      const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 1, x: i }, lod: 0 });
      statistics.trackChunk(chunk);
      time1Chunks.push(chunk);
    }
    time1Chunks.forEach(chunk => chunk.state = "queued");

    const time0Stats = statistics.getStats(0, 0);
    expect(time0Stats.totalChunks).toBe(3);
    expect(time0Stats.unloadedChunks).toBe(3);
    expect(time0Stats.queuedChunks).toBe(0);

    const time1Stats = statistics.getStats(1, 0);
    expect(time1Stats.totalChunks).toBe(2);
    expect(time1Stats.unloadedChunks).toBe(0);
    expect(time1Stats.queuedChunks).toBe(2);
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
    expect(stats.totalChunks).toBe(10);
    expect(stats.unloadedChunks).toBe(7); // 10 - 1 loaded - 1 loading - 1 queued
    expect(stats.queuedChunks).toBe(1);
    expect(stats.loadingChunks).toBe(1);
    expect(stats.loadedChunks).toBe(1);
    expect(stats.visibleChunks).toBe(5);
    expect(stats.prefetchedChunks).toBe(3);
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
    expect(stats.visibleChunks).toBe(1);
    expect(stats.prefetchedChunks).toBe(1);
  });
});
