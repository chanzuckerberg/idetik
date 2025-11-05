import { Idetik, SliceCoordinates, ChunkedImageLayer } from "../../src";

export interface ChunkInfoOverlayOptions {
  textDiv: HTMLDivElement;
  imageLayer: ChunkedImageLayer;
  sliceCoords: SliceCoordinates;
}

export class ChunkInfoOverlay {
  private readonly textDiv_: HTMLDivElement;
  private readonly imageLayer_: ChunkedImageLayer;
  private readonly sliceCoords_: SliceCoordinates;

  constructor({ textDiv, imageLayer, sliceCoords }: ChunkInfoOverlayOptions) {
    this.textDiv_ = textDiv;
    this.imageLayer_ = imageLayer;
    this.sliceCoords_ = sliceCoords;
  }

  public update(idetik: Idetik, _timestamp?: DOMHighResTimeStamp): void {
    if (this.textDiv_.style.display === "none") return;
    const chunkManagerSource = this.imageLayer_.chunkManagerSource;
    if (!chunkManagerSource) {
      this.textDiv_.textContent = "No chunk manager source";
      return;
    }

    const currentTimeIndex = this.sliceCoords_.t ?? 0;
    const stats = chunkManagerSource.statistics;
    const currentLOD = chunkManagerSource.currentLOD;
    const lodCount = chunkManagerSource.lodCount;

    const counters: string[] = [];
    for (let lod = 0; lod < lodCount; lod++) {
      const lodStats = stats.getStats(currentTimeIndex, lod);

      const prefix = lod === currentLOD ? `LOD ${lod}*:` : `LOD ${lod} :`;
      counters.push(
        `${prefix} Visible ${lodStats.visibleChunks} | ` +
          `Loaded ${lodStats.loadedChunks} | ` +
          `Loading ${lodStats.loadingChunks} | ` +
          `Queued ${lodStats.queuedChunks}`
      );
    }

    const numTextures = idetik.textureInfo.textures;
    const totalTextureSize = idetik.textureInfo.totalBytes;
    const totalTextureSizeMB = Math.round(totalTextureSize / (1024 * 1024));

    this.textDiv_.innerHTML = [
      ...counters,
      "",
      `Number of textures ${numTextures}`,
      `GPU Texture Memory in use ${totalTextureSizeMB}MB`,
      `Rendered objects: ${idetik.renderedObjects}`,
    ].join("<br>");
  }
}
