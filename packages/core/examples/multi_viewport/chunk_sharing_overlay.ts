import { Idetik } from "../../src/idetik";
import { ChunkedImageLayer } from "../../src/layers/chunked_image_layer";
import { Chunk } from "../../src/data/chunk";

export interface ChunkSharingOverlayOptions {
  textDiv: HTMLDivElement;
  imageLayers: ChunkedImageLayer[];
  viewportNames: string[];
}

export class ChunkSharingOverlay {
  private readonly textDiv_: HTMLDivElement;
  private readonly imageLayers_: ChunkedImageLayer[];
  private readonly viewportNames_: string[];

  constructor({
    textDiv,
    imageLayers,
    viewportNames,
  }: ChunkSharingOverlayOptions) {
    this.textDiv_ = textDiv;
    this.imageLayers_ = imageLayers;
    this.viewportNames_ = viewportNames;
  }

  public update(idetik: Idetik, _timestamp?: DOMHighResTimeStamp): void {
    if (this.textDiv_.style.display === "none") return;

    // Get the shared chunk store from the first layer
    const chunkStore = this.imageLayers_[0]?.chunkStore;
    if (!chunkStore) {
      this.textDiv_.textContent = "No chunk store";
      return;
    }

    const lines: string[] = [];

    // Overall texture memory stats
    const numTextures = idetik.textureInfo.textures;
    const totalTextureSize = idetik.textureInfo.totalBytes;
    const totalTextureSizeMB = Math.round(totalTextureSize / (1024 * 1024));

    lines.push(`<strong>Shared Chunk Store</strong>`);
    lines.push(`GPU Textures: ${numTextures} (${totalTextureSizeMB}MB)`);
    lines.push("");

    // Collect all chunks being rendered by any viewport
    const allRenderedChunks = new Set<Chunk>();
    const chunkToViewports = new Map<Chunk, Set<number>>();

    this.imageLayers_.forEach((layer, viewportIdx) => {
      const view = layer.chunkStoreView;
      if (!view) return;

      const chunks = view.getChunks(layer.sliceCoords);
      chunks.forEach((chunk) => {
        allRenderedChunks.add(chunk);
        if (!chunkToViewports.has(chunk)) {
          chunkToViewports.set(chunk, new Set());
        }
        chunkToViewports.get(chunk)!.add(viewportIdx);
      });
    });

    // Count shared chunks
    let sharedChunks = 0;
    let uniqueChunks = 0;
    chunkToViewports.forEach((viewports) => {
      if (viewports.size > 1) {
        sharedChunks++;
      } else {
        uniqueChunks++;
      }
    });

    lines.push(`<strong>Chunk Rendering</strong>`);
    lines.push(`Total chunks rendered: ${allRenderedChunks.size}`);
    lines.push(`Shared across viewports: ${sharedChunks}`);
    lines.push(`Unique to one viewport: ${uniqueChunks}`);
    lines.push("");

    // Per-viewport details
    this.imageLayers_.forEach((layer, idx) => {
      const view = layer.chunkStoreView;
      if (!view) return;

      const viewportName = this.viewportNames_[idx] || `Viewport ${idx + 1}`;
      const chunks = view.getChunks(layer.sliceCoords);
      const currentLOD = view.currentLOD;

      // Count view-specific stats from chunkViewStates
      let visibleCount = 0;
      let prefetchCount = 0;

      view.chunkViewStates.forEach((state) => {
        if (state.visible) visibleCount++;
        if (state.prefetch) prefetchCount++;
      });

      lines.push(`<strong>${viewportName}</strong> (LOD ${currentLOD})`);
      lines.push(`Rendering: ${chunks.length} chunks`);
      lines.push(
        `View state: ${visibleCount} visible, ${prefetchCount} prefetch`
      );
      lines.push("");
    });

    this.textDiv_.innerHTML = lines.join("<br>");
  }
}
