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

    // Get statistics from the efficient statistics tracker instead of iterating
    const chunksAtCurrentTime = chunkManagerSource.getChunksAtCurrentTime();
    if (!chunksAtCurrentTime) {
      this.textDiv_.textContent = "No chunks available";
      return;
    }

    const currentTimeIndex = chunksAtCurrentTime[0]?.chunkIndex.t ?? 0;
    const stats =
      chunkManagerSource.statistics.getStatsForTime(currentTimeIndex);

    const chunkDetails: string[] = [];
    const currentLOD = chunkManagerSource.currentLOD;

    // We still need to iterate over rendered chunks since rendering depends on
    // frustum culling which happens separately from visibility tracking
    const renderedChunks = chunkManagerSource.getChunks();
    const renderedCountPerLOD = new Map<number, number>();
    renderedChunks.forEach((chunk: Chunk) => {
      const count = renderedCountPerLOD.get(chunk.lod) ?? 0;
      renderedCountPerLOD.set(chunk.lod, count + 1);
    });

    chunkDetails.push(`Total rendered: ${renderedChunks.length} chunks`);

    const totalChunks = stats.totalChunks;
    const loadedChunks = stats.loadedChunks;
    const loadingChunks = stats.loadingChunks;

    const status = loadingChunks > 0 ? "Loading..." : "Ready";
    const summary = `Chunks at time point: ${loadedChunks}/${totalChunks} ${status}`;

    const counters: string[] = [];
    for (let lod = 0; lod < chunkManagerSource.lodCount; lod++) {
      const lodStats = stats.perLOD.get(lod);
      const visibleCount = lodStats?.visibleChunks ?? 0;
      const prefetchedCount = lodStats?.prefetchedChunks ?? 0;
      const renderedCount = renderedCountPerLOD.get(lod) ?? 0;

      const prefix = lod === currentLOD ? `LOD ${lod} (current)` : `LOD ${lod}`;
      counters.push(
        `${prefix}: Visible ${visibleCount} | Rendered ${renderedCount} | Prefetched ${prefetchedCount}`
      );
    }

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
      `Rendered objects: ${idetik.renderedObjects}`,
    ].join("<br>");
  }
}
