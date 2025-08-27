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
    const chunkSourceView = this.imageLayer_.chunkSourceView;
    if (!chunkSourceView) {
      this.textDiv_.textContent = "No chunk source view ";
      return;
    }

    const allChunks = chunkSourceView.chunks;
    if (!allChunks) {
      this.textDiv_.textContent = "No chunks available";
      return;
    }

    const chunkDetails: string[] = [];
    const currentLOD = chunkSourceView.currentLOD;
    const renderedChunks = chunkSourceView.getChunks();
    const totalChunks = allChunks.length;

    let loadedChunks = 0;
    let loadingChunks = 0;
    allChunks.forEach((chunk: Chunk) => {
      if (chunk.state === "loaded") {
        loadedChunks++;
      } else if (chunk.state === "loading") {
        loadingChunks++;
      }
    });

    const lodCounters: {
      visible: number;
      rendered: number;
      prefetched: number;
    }[] = Array.from({ length: chunkSourceView.lodCount }, () => ({
      visible: 0,
      rendered: 0,
      prefetched: 0,
    }));

    allChunks.forEach((chunk: Chunk) => {
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

    if (renderedChunks.length > 0) {
      chunkDetails.push(`Total rendered: ${renderedChunks.length} chunks`);
    }

    const status = loadingChunks > 0 ? "Loading..." : "Ready";
    const summary = `Chunks: ${loadedChunks}/${totalChunks} ${status}`;
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
