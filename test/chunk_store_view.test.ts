import { describe, expect, test, vi } from "vitest";
import { ChunkStore } from "@/core/chunk_store";
import { ChunkLoader, SourceDimensionMap } from "@/data/chunk";
import { createNoPrefetchPolicy } from "@/core/image_source_policy";
import { createTestViewport } from "./helpers";

describe("ChunkStoreView disposal", () => {
  test("disposed view's chunks ready for cancellation", () => {
    const loader = createMockLoader();
    const store = new ChunkStore(loader);
    const policy = createNoPrefetchPolicy();
    const view = store.createView(policy);
    const viewport = createTestViewport();

    // mark some chunks as visible/needed
    view.updateChunksForImage({ z: 0, c: [0], t: 0 }, viewport);
    expect(view.chunkViewStates.size).toBeGreaterThan(0);

    // aggregate states and set priority
    let collectedChunks = store.updateAndCollectChunkChanges();
    expect(collectedChunks.size).toBeGreaterThan(0);

    // verify some chunks have priority (are needed)
    for (const chunk of collectedChunks) {
      expect(chunk.priority).not.toBe(null);
    }

    view.dispose();

    // collection should return affected chunks from the disposed view
    // chunks should have priority=null and visible=false (ready for cancellation)
    collectedChunks = store.updateAndCollectChunkChanges();

    expect(collectedChunks.size).toBeGreaterThan(0);

    for (const chunk of collectedChunks) {
      expect(chunk.priority).toBe(null);
      expect(chunk.visible).toBe(false);
    }
  });

  test("disposed view's chunks needed by another view", () => {
    const loader = createMockLoader();
    const store = new ChunkStore(loader);
    const policy = createNoPrefetchPolicy();

    const view1 = store.createView(policy);
    const view2 = store.createView(policy);
    const viewport = createTestViewport();

    // Both views mark same chunks as needed
    view1.updateChunksForImage({ z: 0, c: [0], t: 0 }, viewport);
    view2.updateChunksForImage({ z: 0, c: [0], t: 0 }, viewport);

    store.updateAndCollectChunkChanges();

    view1.dispose();

    const collectedChunks = store.updateAndCollectChunkChanges();
    expect(collectedChunks.size).toBeGreaterThan(0);

    // chunks should still have priority because view2 still needs them
    for (const chunk of collectedChunks) {
      expect(chunk.priority).not.toBe(null);
    }
  });
});

function createMockLoader(): ChunkLoader {
  return {
    getSourceDimensionMap: createSimpleDimensions,
    loadChunkData: vi.fn(),
  };
}

function createSimpleDimensions(): SourceDimensionMap {
  return {
    x: {
      name: "x",
      index: 0,
      lods: [
        {
          size: 512,
          scale: 1,
          chunkSize: 256,
          translation: 0,
        },
      ],
    },
    y: {
      name: "y",
      index: 1,
      lods: [
        {
          size: 512,
          scale: 1,
          chunkSize: 256,
          translation: 0,
        },
      ],
    },
    z: {
      name: "z",
      index: 2,
      lods: [
        {
          size: 10,
          scale: 1,
          chunkSize: 5,
          translation: 0,
        },
      ],
    },
    numLods: 1,
  };
}
