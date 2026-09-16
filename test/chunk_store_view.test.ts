import { describe, expect, test } from "vitest";
import { ChunkStore } from "@/data/chunk_store";
import { Chunk, SourceDimensionMap } from "@/data/chunk";
import { Box2 } from "@/math/box2";
import { vec2 } from "gl-matrix";
import { createNoPrefetchPolicy } from "@/core/image_source_policy";
import { OrthographicCamera } from "@/objects/cameras/orthographic_camera";
import { Viewport } from "@/core/viewport";
import { createTestViewport } from "./helpers";

function imageView(viewport: Viewport) {
  return {
    worldViewRect: (viewport.camera as OrthographicCamera).getWorldViewRect(),
    bufferWidthPx: viewport.getBufferRect().width,
  };
}

describe("ChunkStoreView disposal", () => {
  test("disposed view's chunks ready for cancellation", () => {
    const store = new ChunkStore(createSimpleDimensions());
    const policy = createNoPrefetchPolicy();
    const view = store.addView(policy);
    const viewport = createTestViewport();

    // mark some chunks as visible/needed
    view.updateChunksForImage({ z: 0, c: [0], t: 0 }, imageView(viewport));
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
    const store = new ChunkStore(createSimpleDimensions());
    const policy = createNoPrefetchPolicy();

    const view1 = store.addView(policy);
    const view2 = store.addView(policy);
    const viewport = createTestViewport();

    // Both views mark same chunks as needed
    view1.updateChunksForImage({ z: 0, c: [0], t: 0 }, imageView(viewport));
    view2.updateChunksForImage({ z: 0, c: [0], t: 0 }, imageView(viewport));

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

// Drawing opportunistic resident chunks the update pass never marked means re-deriving which of
// them cover the slice
describe("ChunkStoreView multiscale rendering", () => {
  // parameterized over z because z is downsampled in this pyramid
  // coarser chunks span several finer slices
  // the slice coordinate lands mid-chunk for some values
  test.each([0, 1, 2, 3])(
    "zooming in at z=%i keeps the level just left behind ahead of the backdrop",
    (z) => {
      const store = new ChunkStore(createPyramidDimensions());
      const view = store.addView(createNoPrefetchPolicy());
      const lodsOf = () => [
        ...new Set(view.getChunksToRender().map((chunk) => chunk.lod)),
      ];

      view.updateChunksForImage({ z, c: [0] }, viewOfWidth(256));
      expect(view.currentLOD).toBe(1);
      makeResident(store, 1);
      makeResident(store, 2);
      store.updateAndCollectChunkChanges();
      expect(lodsOf()).toEqual([1, 2]);

      view.updateChunksForImage({ z, c: [0] }, viewOfWidth(512));
      expect(view.currentLOD).toBe(0);
      store.updateAndCollectChunkChanges();
      expect(lodsOf()).toEqual([1, 2]);
    }
  );

  // the `changed` check operates at 1-z-chunk-thick slab granularity
  // but z chunks may be smaller than that slab for finer LODs
  test("moving z within one slab still picks the right finer chunk", () => {
    const store = new ChunkStore(createPyramidDimensions());
    const view = store.addView(createNoPrefetchPolicy());
    makeResident(store, 0);
    const finerZ = () =>
      new Set(
        view
          .getChunksToRender()
          .filter((chunk) => chunk.lod === 0)
          .map((chunk) => chunk.chunkIndex.z)
      );

    // LOD 1's z chunks span [0,2) and [2,4), so z=0 and z=1 share a slab
    view.updateChunksForImage({ z: 0, c: [0] }, viewOfWidth(256));
    expect(view.currentLOD).toBe(1);
    expect(finerZ()).toEqual(new Set([0]));

    view.updateChunksForImage({ z: 1, c: [0] }, viewOfWidth(256));
    expect(finerZ()).toEqual(new Set([1]));
  });
});

// A 512-unit view over `bufferWidthPx` pixels: 256 selects LOD 1, 512 LOD 0.
function viewOfWidth(bufferWidthPx: number) {
  return {
    worldViewRect: new Box2(vec2.fromValues(0, 0), vec2.fromValues(512, 512)),
    bufferWidthPx,
  };
}

function makeResident(store: ChunkStore, lod: number) {
  for (const chunk of store.getChunkGrid(lod, 0, 0)!.flat(2)) {
    chunk.state = "loaded";
    chunk.texture = {} as Chunk["texture"];
    store.addResidentChunk(chunk);
  }
}

function createPyramidDimensions(): SourceDimensionMap {
  const plane = [512, 256, 128].map((size, lod) => ({
    size,
    scale: 2 ** lod,
    chunkSize: 64,
    translation: 0,
  }));
  const z = [4, 2, 1].map((size, lod) => ({
    size,
    scale: 2 ** lod,
    chunkSize: 1,
    translation: 0,
  }));
  return {
    x: { name: "x", index: 0, lods: plane },
    y: { name: "y", index: 1, lods: plane },
    z: { name: "z", index: 2, lods: z },
    numLods: 3,
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
