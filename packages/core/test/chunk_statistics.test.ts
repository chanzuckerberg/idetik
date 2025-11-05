import { describe, expect, test } from "vitest";
import { ChunkStatistics } from "@/core/chunk_statistics";
import { makeChunk } from "./helpers";

describe("ChunkStatistics", () => {
  test("initializes with zero counts", () => {
    const stats = new ChunkStatistics();
    const timeStats = stats.getStatsForTime(0);

    expect(timeStats.totalChunks).toBe(0);
    expect(timeStats.unloadedChunks).toBe(0);
    expect(timeStats.queuedChunks).toBe(0);
    expect(timeStats.loadingChunks).toBe(0);
    expect(timeStats.loadedChunks).toBe(0);
  });

  test("tracks chunk and initializes counts", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 0 } });

    stats.trackChunk(chunk);

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.totalChunks).toBe(1);
    expect(timeStats.unloadedChunks).toBe(1);
  });

  test("tracks multiple chunks at same time index", () => {
    const stats = new ChunkStatistics();

    for (let i = 0; i < 10; i++) {
      const chunk = makeChunk({
        state: "unloaded",
        chunkIndex: { t: 0, x: i },
      });
      stats.trackChunk(chunk);
    }

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.totalChunks).toBe(10);
    expect(timeStats.unloadedChunks).toBe(10);
  });

  test("tracks chunks at different time indices", () => {
    const stats = new ChunkStatistics();

    for (let t = 0; t < 5; t++) {
      for (let i = 0; i < 3; i++) {
        const chunk = makeChunk({
          state: "unloaded",
          chunkIndex: { t, x: i },
        });
        stats.trackChunk(chunk);
      }
    }

    for (let t = 0; t < 5; t++) {
      const timeStats = stats.getStatsForTime(t);
      expect(timeStats.totalChunks).toBe(3);
      expect(timeStats.unloadedChunks).toBe(3);
    }
  });

  test("automatically observes state transition from unloaded to queued", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 0 } });

    stats.trackChunk(chunk);

    // Change state - observer is notified automatically
    chunk.state = "queued";

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.unloadedChunks).toBe(0);
    expect(timeStats.queuedChunks).toBe(1);
  });

  test("automatically observes state transition from queued to loading", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 0 } });

    stats.trackChunk(chunk);
    chunk.state = "queued";
    chunk.state = "loading";

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.queuedChunks).toBe(0);
    expect(timeStats.loadingChunks).toBe(1);
  });

  test("automatically observes state transition from loading to loaded", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 0 } });

    stats.trackChunk(chunk);
    chunk.state = "queued";
    chunk.state = "loading";
    chunk.state = "loaded";

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.loadingChunks).toBe(0);
    expect(timeStats.loadedChunks).toBe(1);
  });

  test("automatically observes state transition from loading to unloaded on error", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 0 } });

    stats.trackChunk(chunk);
    chunk.state = "queued";
    chunk.state = "loading";
    chunk.state = "unloaded";

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.loadingChunks).toBe(0);
    expect(timeStats.unloadedChunks).toBe(1);
  });

  test("ignores state change to same state", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 0 } });

    stats.trackChunk(chunk);
    const beforeStats = stats.getStatsForTime(0);

    chunk.state = "unloaded"; // No change

    const afterStats = stats.getStatsForTime(0);
    expect(afterStats).toEqual(beforeStats);
  });

  test("automatically observes visibility change to true", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 1,
      visible: false,
    });

    stats.trackChunk(chunk);
    chunk.visible = true;

    const timeStats = stats.getStatsForTime(0);
    const lodStats = timeStats.perLOD.get(1);
    expect(lodStats?.visibleChunks).toBe(1);
  });

  test("automatically observes visibility change to false", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 1,
      visible: false,
    });

    stats.trackChunk(chunk);
    chunk.visible = true;
    chunk.visible = false;

    const timeStats = stats.getStatsForTime(0);
    const lodStats = timeStats.perLOD.get(1);
    expect(lodStats?.visibleChunks).toBe(0);
  });

  test("tracks visibility across multiple LODs", () => {
    const stats = new ChunkStatistics();

    for (let lod = 0; lod < 3; lod++) {
      for (let i = 0; i < lod + 1; i++) {
        const chunk = makeChunk({
          state: "unloaded",
          chunkIndex: { t: 0, x: i },
          lod,
          visible: false,
        });
        stats.trackChunk(chunk);
        chunk.visible = true;
      }
    }

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.perLOD.get(0)?.visibleChunks).toBe(1);
    expect(timeStats.perLOD.get(1)?.visibleChunks).toBe(2);
    expect(timeStats.perLOD.get(2)?.visibleChunks).toBe(3);
  });

  test("automatically observes prefetch change to true", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 1,
      prefetch: false,
    });

    stats.trackChunk(chunk);
    chunk.prefetch = true;

    const timeStats = stats.getStatsForTime(0);
    const lodStats = timeStats.perLOD.get(1);
    expect(lodStats?.prefetchedChunks).toBe(1);
  });

  test("automatically observes prefetch change to false", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 1,
      prefetch: false,
    });

    stats.trackChunk(chunk);
    chunk.prefetch = true;
    chunk.prefetch = false;

    const timeStats = stats.getStatsForTime(0);
    const lodStats = timeStats.perLOD.get(1);
    expect(lodStats?.prefetchedChunks).toBe(0);
  });

  test("automatically observes LOD change", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 0,
      visible: true,
      prefetch: false,
    });

    stats.trackChunk(chunk);

    // Change LOD from 0 to 1
    chunk.lod = 1;

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.perLOD.get(0)?.visibleChunks).toBe(0);
    expect(timeStats.perLOD.get(1)?.visibleChunks).toBe(1);
  });

  test("ignores LOD change to same LOD", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 0,
      visible: true,
    });

    stats.trackChunk(chunk);
    const beforeStats = stats.getStatsForTime(0);

    chunk.lod = 0; // No change

    const afterStats = stats.getStatsForTime(0);
    expect(afterStats).toEqual(beforeStats);
  });

  test("untracks chunk and removes counts", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({
      state: "loaded",
      chunkIndex: { t: 0 },
      visible: true,
      prefetch: false,
    });

    stats.trackChunk(chunk);
    chunk.state = "loaded";
    chunk.visible = true;

    stats.untrackChunk(chunk);

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.totalChunks).toBe(0);
    expect(timeStats.loadedChunks).toBe(0);
  });

  test("disposes time index", () => {
    const stats = new ChunkStatistics();

    for (let i = 0; i < 5; i++) {
      const chunk = makeChunk({
        state: "unloaded",
        chunkIndex: { t: 0, x: i },
      });
      stats.trackChunk(chunk);
    }

    const beforeStats = stats.getStatsForTime(0);
    expect(beforeStats.totalChunks).toBe(5);

    stats.disposeTimeIndex(0);

    const afterStats = stats.getStatsForTime(0);
    expect(afterStats.totalChunks).toBe(0);
    expect(afterStats.unloadedChunks).toBe(0);
  });

  test("returns empty stats for non-existent time index", () => {
    const stats = new ChunkStatistics();
    const timeStats = stats.getStatsForTime(999);

    expect(timeStats.totalChunks).toBe(0);
    expect(timeStats.unloadedChunks).toBe(0);
    expect(timeStats.queuedChunks).toBe(0);
    expect(timeStats.loadingChunks).toBe(0);
    expect(timeStats.loadedChunks).toBe(0);
    expect(timeStats.perLOD.size).toBe(0);
  });

  test("tracks multiple time indices independently", () => {
    const stats = new ChunkStatistics();

    // Time 0: 3 chunks, all unloaded
    for (let i = 0; i < 3; i++) {
      const chunk = makeChunk({
        state: "unloaded",
        chunkIndex: { t: 0, x: i },
      });
      stats.trackChunk(chunk);
    }

    // Time 1: 2 chunks, transition to queued
    const time1Chunks = [];
    for (let i = 0; i < 2; i++) {
      const chunk = makeChunk({
        state: "unloaded",
        chunkIndex: { t: 1, x: i },
      });
      stats.trackChunk(chunk);
      time1Chunks.push(chunk);
    }
    time1Chunks.forEach((chunk) => (chunk.state = "queued"));

    const time0Stats = stats.getStatsForTime(0);
    expect(time0Stats.totalChunks).toBe(3);
    expect(time0Stats.unloadedChunks).toBe(3);
    expect(time0Stats.queuedChunks).toBe(0);

    const time1Stats = stats.getStatsForTime(1);
    expect(time1Stats.totalChunks).toBe(2);
    expect(time1Stats.unloadedChunks).toBe(0);
    expect(time1Stats.queuedChunks).toBe(2);
  });

  test("complex scenario with multiple state changes", () => {
    const stats = new ChunkStatistics();

    // Create 10 chunks at time 0, LOD 0
    const chunks = [];
    for (let i = 0; i < 10; i++) {
      const chunk = makeChunk({
        state: "unloaded",
        chunkIndex: { t: 0, x: i },
        lod: 0,
      });
      stats.trackChunk(chunk);
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

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.totalChunks).toBe(10);
    expect(timeStats.unloadedChunks).toBe(7); // 10 - 1 loaded - 1 loading - 1 queued
    expect(timeStats.queuedChunks).toBe(1);
    expect(timeStats.loadingChunks).toBe(1);
    expect(timeStats.loadedChunks).toBe(1);

    const lodStats = timeStats.perLOD.get(0);
    expect(lodStats?.visibleChunks).toBe(5);
    expect(lodStats?.prefetchedChunks).toBe(3);
  });

  test("tracks chunks with initial visible/prefetch state", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 0,
      visible: true,
      prefetch: true,
    });

    stats.trackChunk(chunk);

    const timeStats = stats.getStatsForTime(0);
    const lodStats = timeStats.perLOD.get(0);
    expect(lodStats?.visibleChunks).toBe(1);
    expect(lodStats?.prefetchedChunks).toBe(1);
  });
});
