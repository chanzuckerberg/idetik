import { Idetik } from "../../src/idetik";
import { ChunkedImageLayer } from "../../src/layers/chunked_image_layer";
import { Chunk } from "../../src/data/chunk";

export interface ChunkInfoOverlayOptions {
  textDiv: HTMLDivElement;
  imageLayer: ChunkedImageLayer;
}

export class ChunkInfoOverlay {
  private readonly textDiv_: HTMLDivElement;
  private readonly imageLayer_: ChunkedImageLayer;

  constructor({ textDiv, imageLayer }: ChunkInfoOverlayOptions) {
    this.textDiv_ = textDiv;
    this.imageLayer_ = imageLayer;
  }

  public update(idetik: Idetik, _timestamp?: DOMHighResTimeStamp): void {
    if (this.textDiv_.style.display === "none") return;
    const chunkStore = this.imageLayer_.chunkStore;
    const chunkStoreView = this.imageLayer_.chunkStoreView;
    if (!chunkStore || !chunkStoreView) {
      this.textDiv_.textContent = "No chunk store";
      return;
    }

    const chunksAtCurrentTime = chunkStore.getChunksAtTime(
      chunkStore.getTimeIndex(this.imageLayer_.sliceCoords)
    );
    if (!chunksAtCurrentTime) {
      this.textDiv_.textContent = "No chunks available";
      return;
    }

    const chunkDetails: string[] = [];
    const currentLOD = chunkStoreView.currentLOD;
    const renderedChunks = chunkStoreView.getChunks(this.imageLayer_.sliceCoords);
    const totalChunks = chunksAtCurrentTime.length;

    let loadedChunks = 0;
    let loadingChunks = 0;
    const lodCounters: {
      visible: number;
      rendered: number;
      prefetched: number;
    }[] = Array.from({ length: chunkStore.lodCount }, () => ({
      visible: 0,
      rendered: 0,
      prefetched: 0,
    }));
    chunksAtCurrentTime.forEach((chunk: Chunk) => {
      if (chunk.state === "loaded") {
        loadedChunks++;
      } else if (chunk.state === "loading") {
        loadingChunks++;
      }
      if (chunk.visible) lodCounters[chunk.lod].visible++;
      // Prefetched chunks are only counted for the current LOD,
      // since higher/lower LODs are not actively rendered.
      if (chunk.lod === currentLOD && chunk.prefetch) {
        lodCounters[chunk.lod].prefetched++;
      }
    });

    renderedChunks.forEach((chunk: Chunk) => {
      lodCounters[chunk.lod].rendered++;
    });

    chunkDetails.push(`Total rendered: ${renderedChunks.length} chunks`);

    const status = loadingChunks > 0 ? "Loading..." : "Ready";
    const summary = `Chunks at time point: ${loadedChunks}/${totalChunks} ${status}`;
    const counters: string[] = [];
    lodCounters.forEach((counter, lod) => {
      const prefix = lod === currentLOD ? `LOD ${lod} (current)` : `LOD ${lod}`;
      counters.push(
        `${prefix}: Visible ${counter.visible} | Rendered ${counter.rendered} | Prefetched ${counter.prefetched}`
      );
    });

    const numTextures = idetik.textureInfo.textures;
    const totalTextureSize = idetik.textureInfo.totalBytes;
    const totalTextureSizeMB = Math.round(totalTextureSize / (1024 * 1024));

    this.textDiv_.innerHTML = [
      summary,
      "",
      ...counters,
      "",
      ...chunkDetails,
      "",
      `Number of textures ${numTextures}`,
      `GPU Texture Memory in use ${totalTextureSizeMB}MB`,
    ].join("<br>");
  }
}
