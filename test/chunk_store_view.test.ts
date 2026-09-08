import { describe, expect, test } from "vitest";
import { mat4, vec3 } from "gl-matrix";
import { ChunkStore } from "@/data/chunk_store";
import { ChunkStoreView } from "@/data/chunk_store_view";
import { SourceDimensionMap } from "@/data/chunk";
import { createNoPrefetchPolicy } from "@/core/image_source_policy";
import { Viewport } from "@/core/viewport";
import { createTestViewport } from "./helpers";

function imageView(
  viewport: Viewport
): [mat4, { width: number; height: number }] {
  return [viewport.camera.getViewProjection(), viewport.getBufferRect()];
}

describe("ChunkStoreView disposal", () => {
  test("disposed view's chunks ready for cancellation", () => {
    const store = new ChunkStore(dimensions());
    const policy = createNoPrefetchPolicy();
    const view = store.addView(policy);
    const viewport = createTestViewport();

    // mark some chunks as visible/needed
    view.updateChunksForImage({ z: 0, c: [0], t: 0 }, ...imageView(viewport));
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
    const store = new ChunkStore(dimensions());
    const policy = createNoPrefetchPolicy();

    const view1 = store.addView(policy);
    const view2 = store.addView(policy);
    const viewport = createTestViewport();

    // Both views mark same chunks as needed
    view1.updateChunksForImage({ z: 0, c: [0], t: 0 }, ...imageView(viewport));
    view2.updateChunksForImage({ z: 0, c: [0], t: 0 }, ...imageView(viewport));

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

/** A square image over `levels` powers of two, chunked at `chunkSize`. */
function dimensions({
  levels = 1,
  size = 512,
  chunkSize = 256,
} = {}): SourceDimensionMap {
  const axis = (name: string, index: number, base: number, chunk: number) => ({
    name,
    index,
    lods: Array.from({ length: levels }, (_, lod) => ({
      size: Math.max(1, base >> lod),
      scale: 2 ** lod,
      chunkSize: chunk,
      translation: 0,
    })),
  });

  return {
    x: axis("x", 0, size, chunkSize),
    y: axis("y", 1, size, chunkSize),
    z: axis("z", 2, 10, 5),
    numLods: levels,
  };
}

describe("ChunkStoreView slice plane", () => {
  const viewFor = (dimensions: SourceDimensionMap) =>
    new ChunkStore(dimensions).addView(createNoPrefetchPolicy());

  test("resolves the cross-axis position only when it is unambiguous", () => {
    // a real extent and no coordinate: the layer spans the axis, so undefined
    const withExtent = dimensions();
    expect(
      viewFor(withExtent).slicePlaneValue({ c: [0], t: 0 })
    ).toBeUndefined();

    const noCrossAxis = dimensions();
    delete noCrossAxis.z;
    expect(viewFor(noCrossAxis).slicePlaneValue({ c: [0], t: 0 })).toBe(0);
  });
});

describe("LOD selection", () => {
  const BUFFER = { width: 1200, height: 1200 };
  const CENTRE = 4096;
  const IMAGE = { levels: 6, size: 8192, chunkSize: 256 };

  /** Looking at the middle of the slice from `distance`, tilted off its normal. */
  function camera(distance: number, tiltDeg: number): mat4 {
    const tilt = (tiltDeg * Math.PI) / 180;
    return mat4.multiply(
      mat4.create(),
      mat4.perspective(mat4.create(), Math.PI / 3, 1, 1, 1e7),
      mat4.lookAt(
        mat4.create(),
        vec3.fromValues(
          CENTRE,
          CENTRE - distance * Math.sin(tilt),
          distance * Math.cos(tilt)
        ),
        vec3.fromValues(CENTRE, CENTRE, 0),
        vec3.fromValues(0, Math.cos(tilt), Math.sin(tilt))
      )
    );
  }

  const lodAt = (view: ChunkStoreView, distance: number, tiltDeg: number) => {
    view.updateChunksForImage(
      { z: 0, c: [0], t: 0 },
      camera(distance, tiltDeg),
      BUFFER
    );
    return view.currentLOD;
  };

  const viewOf = (overrides = {}) =>
    new ChunkStore(dimensions({ ...IMAGE, ...overrides })).addView(
      createNoPrefetchPolicy()
    );

  test("steps one level per doubling of distance", () => {
    const view = viewOf();
    const levels = [2000, 4000, 8000, 16000].map((d) => lodAt(view, d, 0));

    for (let i = 1; i < levels.length; ++i) {
      expect(levels[i]).toBe(levels[i - 1] + 1);
    }
  });

  test("coarsens with tilt and never steps back finer", () => {
    const view = viewOf();
    const faceOn = lodAt(view, 4000, 0);
    let previous = faceOn;

    for (let deg = 2; deg <= 88; deg += 2) {
      const level = lodAt(view, 4000, deg);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }

    expect(previous).toBeGreaterThan(faceOn);
  });

  test("will not spend a fine level covering a grazing slice", () => {
    // The near strip resolves finely and would carry the average on its own,
    // but the level it asks for would cover the whole image in fine chunks.
    const view = viewOf();
    lodAt(view, 30 / Math.cos((65 * Math.PI) / 180), 65);

    let chunks = 0;
    for (const [chunk, state] of view.chunkViewStates) {
      if (state.visible && chunk.lod === view.currentLOD) ++chunks;
    }

    // the whole image is in view, so this is what the level costs outright
    expect(view.currentLOD).toBeGreaterThan(0);
    expect(chunks).toBeLessThan(256);
  });

  test("chooses the same level whatever the chunk size", () => {
    const levels = [64, 256, 1024].map((chunkSize) =>
      lodAt(viewOf({ chunkSize }), 4000, 65)
    );

    expect(levels[1]).toBe(levels[0]);
    expect(levels[2]).toBe(levels[0]);
  });
});
