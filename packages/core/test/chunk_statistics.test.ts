import { describe, expect, test } from "vitest";
import { ChunkStatistics } from "@/core/chunk_statistics";
import { makeChunk } from "./helpers";

describe("ChunkStatistics", () => {
  test("initializes with zero counts", () => {
    const stats = new ChunkStatistics();
    const aggregate = stats.getAggregateStats();

    expect(aggregate.totalChunks).toBe(0);
    expect(aggregate.unloadedChunks).toBe(0);
    expect(aggregate.queuedChunks).toBe(0);
    expect(aggregate.loadingChunks).toBe(0);
    expect(aggregate.loadedChunks).toBe(0);
  });

  test("records chunk creation", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 0 } });

    stats.recordChunkCreated(chunk);

    const aggregate = stats.getAggregateStats();
    expect(aggregate.totalChunks).toBe(1);
    expect(aggregate.unloadedChunks).toBe(1);

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.totalChunks).toBe(1);
    expect(timeStats.unloadedChunks).toBe(1);
  });

  test("records multiple chunk creations at same time index", () => {
    const stats = new ChunkStatistics();

    for (let i = 0; i < 10; i++) {
      const chunk = makeChunk({
        state: "unloaded",
        chunkIndex: { t: 0, x: i },
      });
      stats.recordChunkCreated(chunk);
    }

    const aggregate = stats.getAggregateStats();
    expect(aggregate.totalChunks).toBe(10);
    expect(aggregate.unloadedChunks).toBe(10);

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.totalChunks).toBe(10);
  });

  test("records chunk creations at different time indices", () => {
    const stats = new ChunkStatistics();

    for (let t = 0; t < 5; t++) {
      for (let i = 0; i < 3; i++) {
        const chunk = makeChunk({
          state: "unloaded",
          chunkIndex: { t, x: i },
        });
        stats.recordChunkCreated(chunk);
      }
    }

    const aggregate = stats.getAggregateStats();
    expect(aggregate.totalChunks).toBe(15);
    expect(aggregate.unloadedChunks).toBe(15);

    for (let t = 0; t < 5; t++) {
      const timeStats = stats.getStatsForTime(t);
      expect(timeStats.totalChunks).toBe(3);
      expect(timeStats.unloadedChunks).toBe(3);
    }
  });

  test("records state transition from unloaded to queued", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 0 } });

    stats.recordChunkCreated(chunk);
    stats.recordStateTransition(chunk, "unloaded", "queued");

    const aggregate = stats.getAggregateStats();
    expect(aggregate.unloadedChunks).toBe(0);
    expect(aggregate.queuedChunks).toBe(1);

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.unloadedChunks).toBe(0);
    expect(timeStats.queuedChunks).toBe(1);
  });

  test("records state transition from queued to loading", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({ state: "queued", chunkIndex: { t: 0 } });

    stats.recordChunkCreated(chunk);
    stats.recordStateTransition(chunk, "unloaded", "queued");
    stats.recordStateTransition(chunk, "queued", "loading");

    const aggregate = stats.getAggregateStats();
    expect(aggregate.queuedChunks).toBe(0);
    expect(aggregate.loadingChunks).toBe(1);

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.queuedChunks).toBe(0);
    expect(timeStats.loadingChunks).toBe(1);
  });

  test("records state transition from loading to loaded", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({ state: "loading", chunkIndex: { t: 0 } });

    stats.recordChunkCreated(chunk);
    stats.recordStateTransition(chunk, "unloaded", "queued");
    stats.recordStateTransition(chunk, "queued", "loading");
    stats.recordStateTransition(chunk, "loading", "loaded");

    const aggregate = stats.getAggregateStats();
    expect(aggregate.loadingChunks).toBe(0);
    expect(aggregate.loadedChunks).toBe(1);

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.loadingChunks).toBe(0);
    expect(timeStats.loadedChunks).toBe(1);
  });

  test("records state transition from loading to unloaded on error", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({ state: "loading", chunkIndex: { t: 0 } });

    stats.recordChunkCreated(chunk);
    stats.recordStateTransition(chunk, "unloaded", "queued");
    stats.recordStateTransition(chunk, "queued", "loading");
    stats.recordStateTransition(chunk, "loading", "unloaded");

    const aggregate = stats.getAggregateStats();
    expect(aggregate.loadingChunks).toBe(0);
    expect(aggregate.unloadedChunks).toBe(1);

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.loadingChunks).toBe(0);
    expect(timeStats.unloadedChunks).toBe(1);
  });

  test("ignores state transition to same state", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 0 } });

    stats.recordChunkCreated(chunk);
    const beforeAggregate = stats.getAggregateStats();

    stats.recordStateTransition(chunk, "unloaded", "unloaded");

    const afterAggregate = stats.getAggregateStats();
    expect(afterAggregate).toEqual(beforeAggregate);
  });

  test("records visibility change to true", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 1,
      visible: false,
    });

    stats.recordChunkCreated(chunk);
    chunk.visible = true;
    stats.recordVisibilityChange(chunk, true);

    const timeStats = stats.getStatsForTime(0);
    const lodStats = timeStats.perLOD.get(1);
    expect(lodStats?.visibleChunks).toBe(1);
  });

  test("records visibility change to false", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 1,
      visible: true,
    });

    stats.recordChunkCreated(chunk);
    stats.recordVisibilityChange(chunk, true);
    chunk.visible = false;
    stats.recordVisibilityChange(chunk, false);

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
        stats.recordChunkCreated(chunk);
        chunk.visible = true;
        stats.recordVisibilityChange(chunk, true);
      }
    }

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.perLOD.get(0)?.visibleChunks).toBe(1);
    expect(timeStats.perLOD.get(1)?.visibleChunks).toBe(2);
    expect(timeStats.perLOD.get(2)?.visibleChunks).toBe(3);
  });

  test("records prefetch change to true", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 1,
      prefetch: false,
    });

    stats.recordChunkCreated(chunk);
    chunk.prefetch = true;
    stats.recordPrefetchChange(chunk, true);

    const timeStats = stats.getStatsForTime(0);
    const lodStats = timeStats.perLOD.get(1);
    expect(lodStats?.prefetchedChunks).toBe(1);
  });

  test("records prefetch change to false", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 1,
      prefetch: true,
    });

    stats.recordChunkCreated(chunk);
    stats.recordPrefetchChange(chunk, true);
    chunk.prefetch = false;
    stats.recordPrefetchChange(chunk, false);

    const timeStats = stats.getStatsForTime(0);
    const lodStats = timeStats.perLOD.get(1);
    expect(lodStats?.prefetchedChunks).toBe(0);
  });

  test("records LOD change", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({
      state: "unloaded",
      chunkIndex: { t: 0 },
      lod: 0,
      visible: true,
      prefetch: false,
    });

    stats.recordChunkCreated(chunk);
    stats.recordVisibilityChange(chunk, true);

    // Change LOD from 0 to 1
    chunk.lod = 1;
    stats.recordLODChange(chunk, 0, 1);

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

    stats.recordChunkCreated(chunk);
    stats.recordVisibilityChange(chunk, true);

    const beforeStats = stats.getStatsForTime(0);
    stats.recordLODChange(chunk, 0, 0);
    const afterStats = stats.getStatsForTime(0);

    expect(afterStats).toEqual(beforeStats);
  });

  test("records chunk disposal", () => {
    const stats = new ChunkStatistics();
    const chunk = makeChunk({
      state: "loaded",
      chunkIndex: { t: 0 },
      visible: true,
      prefetch: false,
    });

    stats.recordChunkCreated(chunk);
    stats.recordStateTransition(chunk, "unloaded", "loaded");
    stats.recordVisibilityChange(chunk, true);

    stats.recordChunkDisposed(chunk);

    const aggregate = stats.getAggregateStats();
    expect(aggregate.totalChunks).toBe(0);
    expect(aggregate.loadedChunks).toBe(0);

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.totalChunks).toBe(0);
    expect(timeStats.perLOD.get(chunk.lod)?.visibleChunks).toBe(0);
  });

  test("disposes time index", () => {
    const stats = new ChunkStatistics();

    for (let i = 0; i < 5; i++) {
      const chunk = makeChunk({
        state: "unloaded",
        chunkIndex: { t: 0, x: i },
      });
      stats.recordChunkCreated(chunk);
    }

    const beforeAggregate = stats.getAggregateStats();
    expect(beforeAggregate.totalChunks).toBe(5);

    stats.disposeTimeIndex(0);

    const afterAggregate = stats.getAggregateStats();
    expect(afterAggregate.totalChunks).toBe(0);
    expect(afterAggregate.unloadedChunks).toBe(0);

    const timeStats = stats.getStatsForTime(0);
    expect(timeStats.totalChunks).toBe(0);
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
      stats.recordChunkCreated(chunk);
    }

    // Time 1: 2 chunks, transition to queued
    for (let i = 0; i < 2; i++) {
      const chunk = makeChunk({
        state: "unloaded",
        chunkIndex: { t: 1, x: i },
      });
      stats.recordChunkCreated(chunk);
      stats.recordStateTransition(chunk, "unloaded", "queued");
    }

    const time0Stats = stats.getStatsForTime(0);
    expect(time0Stats.totalChunks).toBe(3);
    expect(time0Stats.unloadedChunks).toBe(3);
    expect(time0Stats.queuedChunks).toBe(0);

    const time1Stats = stats.getStatsForTime(1);
    expect(time1Stats.totalChunks).toBe(2);
    expect(time1Stats.unloadedChunks).toBe(0);
    expect(time1Stats.queuedChunks).toBe(2);

    const aggregate = stats.getAggregateStats();
    expect(aggregate.totalChunks).toBe(5);
    expect(aggregate.unloadedChunks).toBe(3);
    expect(aggregate.queuedChunks).toBe(2);
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
      stats.recordChunkCreated(chunk);
      chunks.push(chunk);
    }

    // Make 5 visible
    for (let i = 0; i < 5; i++) {
      chunks[i].visible = true;
      stats.recordVisibilityChange(chunks[i], true);
    }

    // Queue 3 chunks
    for (let i = 0; i < 3; i++) {
      stats.recordStateTransition(chunks[i], "unloaded", "queued");
    }

    // Start loading 2 chunks
    for (let i = 0; i < 2; i++) {
      stats.recordStateTransition(chunks[i], "queued", "loading");
    }

    // Complete loading 1 chunk
    stats.recordStateTransition(chunks[0], "loading", "loaded");

    // Make 3 chunks prefetched
    for (let i = 5; i < 8; i++) {
      chunks[i].prefetch = true;
      stats.recordPrefetchChange(chunks[i], true);
    }

    const aggregate = stats.getAggregateStats();
    expect(aggregate.totalChunks).toBe(10);
    expect(aggregate.unloadedChunks).toBe(7); // 10 - 1 loaded - 1 loading - 1 queued
    expect(aggregate.queuedChunks).toBe(1);
    expect(aggregate.loadingChunks).toBe(1);
    expect(aggregate.loadedChunks).toBe(1);

    const timeStats = stats.getStatsForTime(0);
    const lodStats = timeStats.perLOD.get(0);
    expect(lodStats?.visibleChunks).toBe(5);
    expect(lodStats?.prefetchedChunks).toBe(3);
  });
});
