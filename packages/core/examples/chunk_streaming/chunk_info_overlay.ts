import { Idetik } from "../../src/idetik";
import { ChunkedImageLayer } from "../../src/layers/chunked_image_layer";

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

    // Get statistics from the efficient statistics tracker
    const chunksAtCurrentTime = chunkManagerSource.getChunksAtCurrentTime();
    if (!chunksAtCurrentTime) {
      this.textDiv_.textContent = "No chunks available";
      return;
    }

    const currentTimeIndex = chunksAtCurrentTime[0]?.chunkIndex.t ?? 0;
    const stats = chunkManagerSource.statistics;
    const currentLOD = chunkManagerSource.currentLOD;
    const lodCount = chunkManagerSource.lodCount;

    // Calculate totals across all LODs for this time point
    let totalChunks = 0;
    let totalLoaded = 0;
    let totalLoading = 0;
    let totalQueued = 0;

    for (let lod = 0; lod < lodCount; lod++) {
      const lodStats = stats.getStats(currentTimeIndex, lod);
      totalChunks += lodStats.totalChunks;
      totalLoaded += lodStats.loadedChunks;
      totalLoading += lodStats.loadingChunks;
      totalQueued += lodStats.queuedChunks;
    }

    const status = totalLoading > 0 ? "Loading..." : "Ready";
    const summary = `Chunks at time point: ${totalLoaded}/${totalChunks} ${status}`;

    // Per-LOD breakdown
    const counters: string[] = [];
    for (let lod = 0; lod < lodCount; lod++) {
      const lodStats = stats.getStats(currentTimeIndex, lod);

      const prefix = lod === currentLOD ? `LOD ${lod} (current)` : `LOD ${lod}`;
      counters.push(
        `${prefix}: Loaded ${lodStats.loadedChunks}/${lodStats.totalChunks} | ` +
          `Visible ${lodStats.visibleChunks} | Prefetched ${lodStats.prefetchedChunks}`
      );
    }

    const stateDetails = [
      `Loaded: ${totalLoaded}`,
      `Loading: ${totalLoading}`,
      `Queued: ${totalQueued}`,
    ];

    const numTextures = idetik.textureInfo.textures;
    const totalTextureSize = idetik.textureInfo.totalBytes;
    const totalTextureSizeMB = Math.round(totalTextureSize / (1024 * 1024));

    this.textDiv_.innerHTML = [
      summary,
      "",
      ...counters,
      "",
      ...stateDetails,
      "",
      `Number of textures ${numTextures}`,
      `GPU Texture Memory in use ${totalTextureSizeMB}MB`,
      `Rendered objects: ${idetik.renderedObjects}`,
    ].join("<br>");
  }
}
