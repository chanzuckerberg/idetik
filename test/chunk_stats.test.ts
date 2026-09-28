import { describe, expect, test } from "vitest";
import { ChunkStore } from "@/data/chunk_store";
import { ChunkStoreView } from "@/data/chunk_store_view";
import { ChunkSource, SourceDimensionMap } from "@/data/chunk";
import {
  computeSourceChunkStats,
  computeViewportChunkStats,
} from "@/data/chunk_stats";
import { createNoPrefetchPolicy } from "@/core/image_source_policy";
import type { Texture } from "@/objects/textures/texture";
import { OrthographicCamera } from "@/objects/cameras/orthographic_camera";
import { createTestViewport } from "./helpers";

const source = {} as ChunkSource;

function updateView(view: ChunkStoreView) {
  const viewport = createTestViewport();
  view.updateChunksForImage(
    { z: 0, c: [0], t: 0 },
    {
      worldViewRect: (viewport.camera as OrthographicCamera).getWorldViewRect(),
      bufferWidthPx: viewport.getBufferRect().width,
    }
  );
}

function visibleChunks(view: ChunkStoreView) {
  return [...view.chunkViewStates]
    .filter(([, state]) => state.visible)
    .map(([chunk]) => chunk);
}

describe("chunk stats", () => {
  test("viewport counts chunks its views request", () => {
    const store = new ChunkStore(createDimensions());
    const view = store.addView(createNoPrefetchPolicy());
    updateView(view);

    const visible = visibleChunks(view);
    expect(visible.length).toBeGreaterThan(0);
    visible[0].texture = {} as Texture;

    const stats = computeViewportChunkStats("viewport", [{ store, view }]);

    expect(stats.requested).toBe(visible.length);
    expect(stats.resident).toBe(1);
    expect([...stats.timepoints.requested]).toEqual([visible.length, 0, 0]);
    expect([...stats.timepoints.resident]).toEqual([1, 0, 0]);
  });

  test("source counts chunks shared by views once", () => {
    const store = new ChunkStore(createDimensions());
    const view1 = store.addView(createNoPrefetchPolicy());
    const view2 = store.addView(createNoPrefetchPolicy());
    updateView(view1);
    updateView(view2);

    const visible = visibleChunks(view1);
    visible[0].texture = {} as Texture;

    const stats = computeSourceChunkStats(source, store);

    expect(stats.requested).toBe(visible.length);
    expect(stats.resident).toBe(1);
  });
});

function createDimensions(): SourceDimensionMap {
  return {
    x: {
      name: "x",
      index: 0,
      lods: [{ size: 512, scale: 1, chunkSize: 256, translation: 0 }],
    },
    y: {
      name: "y",
      index: 1,
      lods: [{ size: 512, scale: 1, chunkSize: 256, translation: 0 }],
    },
    z: {
      name: "z",
      index: 2,
      lods: [{ size: 10, scale: 1, chunkSize: 5, translation: 0 }],
    },
    t: {
      name: "t",
      index: 3,
      lods: [{ size: 3, scale: 1, chunkSize: 1, translation: 0 }],
    },
    numLods: 1,
  };
}
