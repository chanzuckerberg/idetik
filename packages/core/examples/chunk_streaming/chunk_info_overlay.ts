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
    const chunkManagerSource = this.imageLayer_.chunkManagerSource;
    if (!chunkManagerSource) {
      this.textDiv_.textContent = "No chunk manager source";
      return;
    }

    const chunksAtCurrentTime = chunkManagerSource.getChunksAtCurrentTime();
    if (!chunksAtCurrentTime) {
      this.textDiv_.textContent = "No chunks available";
      return;
    }

    const currentLOD = chunkManagerSource.currentLOD;
    const renderedChunks = chunkManagerSource.getChunks();
    const totalChunks = chunksAtCurrentTime.length;

    let loadedChunks = 0;
    let loadingChunks = 0;
    const lodCounters: {
      visible: number;
      rendered: number;
      loading: number;
      queued: number;
    }[] = Array.from({ length: chunkManagerSource.lodCount }, () => ({
      visible: 0,
      rendered: 0,
      loading: 0,
      queued: 0,
    }));
    chunksAtCurrentTime.forEach((chunk: Chunk) => {
      if (chunk.state === "loaded") {
        loadedChunks++;
      } else if (chunk.state === "loading") {
        loadingChunks++;
      }
      if (chunk.visible) lodCounters[chunk.lod].visible++;
      if (chunk.state === "queued") {
        lodCounters[chunk.lod].queued++;
      } else if (chunk.state === "loading") {
        lodCounters[chunk.lod].loading++;
      }
    });

    renderedChunks.forEach((chunk: Chunk) => {
      lodCounters[chunk.lod].rendered++;
    });
    const totalLoading = lodCounters.reduce(
      (sum, counter) => sum + counter.loading,
      0
    );
    const totalQueued = lodCounters.reduce(
      (sum, counter) => sum + counter.queued,
      0
    );
    const totalCounts: string[] = [];
    totalCounts.push(
      `Total: Visible ${renderedChunks.length} | Rendered ${renderedChunks.length}  | Loading ${totalLoading} | Queued ${totalQueued}`
    );

    const status = loadingChunks > 0 ? "Loading..." : "Ready";
    const summary = `Chunks at time point: ${loadedChunks}/${totalChunks} ${status}`;
    const counters: string[] = [];
    lodCounters.forEach((counter, lod) => {
      const prefix = lod === currentLOD ? `LOD ${lod} (current)` : `LOD ${lod}`;
      counters.push(
        `${prefix}: Visible ${counter.visible} | Rendered ${counter.rendered} | Loading ${counter.loading} | Queued ${counter.queued}`
      );
    });

    const numTextures = idetik.textureInfo.textures;
    const totalTextureSize = idetik.textureInfo.totalBytes;
    const totalTextureSizeMB = Math.round(totalTextureSize / (1024 * 1024));

    this.textDiv_.innerHTML = [
      summary,
      "",
      ...counters,
      ...totalCounts,
      "",
      `Number of textures ${numTextures}`,
      `GPU Texture Memory in use ${totalTextureSizeMB}MB`,
    ].join("<br>");
  }
}
