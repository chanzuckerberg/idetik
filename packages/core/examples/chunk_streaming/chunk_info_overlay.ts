import { Idetik } from "../../src/idetik";
import { ImageLayer } from "../../src/layers/image_layer";
import { ChunkManagerSource } from "../../src/core/chunk_manager";
import { ImageChunk } from "../../src/data/image_chunk";

export interface ChunkInfoOverlayOptions {
  textDiv: HTMLDivElement;
  imageLayer: ImageLayer;
}

export class ChunkInfoOverlay {
  private textDiv_: HTMLDivElement;
  private imageLayer_: ImageLayer;

  constructor({ textDiv, imageLayer }: ChunkInfoOverlayOptions) {
    this.textDiv_ = textDiv;
    this.imageLayer_ = imageLayer;
  }

  public update(_idetik: Idetik, _timestamp?: DOMHighResTimeStamp): void {
    // Access the chunk manager source through the image layer
    const chunkManagerSource = (this.imageLayer_ as unknown as { chunkManagerSource_?: ChunkManagerSource }).chunkManagerSource_;
    
    if (!chunkManagerSource) {
      this.textDiv_.textContent = "No chunk manager source";
      return;
    }

    const visibleChunks = chunkManagerSource.getChunks();
    const allChunks = (chunkManagerSource as unknown as { chunks_: ImageChunk[] }).chunks_;
    
    if (!allChunks) {
      this.textDiv_.textContent = "No chunks available";
      return;
    }

    const totalChunks = allChunks.length;
    let loadedChunks = 0;
    let loadingChunks = 0;
    const chunkDetails: string[] = [];

    // Get the actual current LOD from the chunk manager source
    const currentLOD = (chunkManagerSource as unknown as { currentLOD_: number }).currentLOD_;

    // Count chunks by state
    allChunks.forEach((chunk: ImageChunk) => {
      if (chunk.state === "loaded") {
        loadedChunks++;
      } else if (chunk.state === "loading") {
        loadingChunks++;
      }
    });

    // Group chunks by LOD and count visible/rendered per LOD
    const lodStats = new Map<number, { visible: number; rendered: number }>();
    
    // Count visible chunks per LOD
    allChunks.forEach((chunk: ImageChunk) => {
      if (chunk.visible) {
        const lod = chunk.lod;
        if (!lodStats.has(lod)) {
          lodStats.set(lod, { visible: 0, rendered: 0 });
        }
        lodStats.get(lod)!.visible++;
      }
    });

    // Count rendered chunks per LOD
    visibleChunks.forEach((chunk: ImageChunk) => {
      const lod = chunk.lod;
      if (!lodStats.has(lod)) {
        lodStats.set(lod, { visible: 0, rendered: 0 });
      }
      lodStats.get(lod)!.rendered++;
    });

    // Get sample chunk for details
    if (visibleChunks.length > 0) {
      const sample = visibleChunks[0];
      chunkDetails.push(`Chunk size: ${sample.shape.x}x${sample.shape.y}`);
      chunkDetails.push(`Scale: ${sample.scale.x.toFixed(2)}, ${sample.scale.y.toFixed(2)}`);
      chunkDetails.push(`Position: (${sample.offset.x.toFixed(1)}, ${sample.offset.y.toFixed(1)})`);
    }

    const status = loadingChunks > 0 ? "Loading..." : "Ready";
    const summary = `Chunks: ${loadedChunks}/${totalChunks} ${status}`;
    
    // Create per-LOD breakdown
    const lodBreakdown: string[] = [];
    const sortedLODs = Array.from(lodStats.keys()).sort((a, b) => a - b);
    
    for (const lod of sortedLODs) {
      const stats = lodStats.get(lod)!;
      const isCurrentLOD = lod === currentLOD;
      const lodLabel = isCurrentLOD ? `LOD ${lod} (current)` : `LOD ${lod}`;
      lodBreakdown.push(`${lodLabel}: Visible: ${stats.visible} | Rendered: ${stats.rendered}`);
    }
    
    this.textDiv_.innerHTML = [
      summary,
      "",
      ...lodBreakdown,
      "",
      ...chunkDetails
    ].join("<br>");
  }
}