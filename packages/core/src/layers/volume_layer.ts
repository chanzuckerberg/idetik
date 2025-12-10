import { Chunk, ChunkSource, SliceCoordinates } from "../data/chunk";
import { Layer, LayerOptions, RenderContext } from "../core/layer";
import { VolumeRenderable } from "../objects/renderable/volume_renderable";
import { IdetikContext } from "../idetik";
import { ChunkStoreView, INTERNAL_POLICY_KEY } from "../core/chunk_store_view";
import { ImageSourcePolicy } from "../core/image_source_policy";
import { Texture3D } from "../objects/textures/texture_3d";
import { RenderablePool } from "../utilities/renderable_pool";
import { vec3 } from "gl-matrix";

export type VolumeLayerProps = LayerOptions & {
  source: ChunkSource;
  sliceCoords: SliceCoordinates;
  policy: ImageSourcePolicy;
};

export type OrderingMode = "front-to-back" | "back-to-front";

export class VolumeLayer extends Layer {
  public readonly type = "VolumeLayer";

  private readonly source_: ChunkSource;
  private readonly sliceCoords_: SliceCoordinates;
  private readonly visibleChunks_: Map<Chunk, VolumeRenderable> = new Map();
  private readonly pool_ = new RenderablePool<VolumeRenderable>();

  private sourcePolicy_: ImageSourcePolicy;
  private chunkStoreView_?: ChunkStoreView;
  private lod_ = -1;
  private debugMode_ = false;

  private lastLoadedLod_ = -1;
  private lastLoadedTime_ = -1;
  private hitMisses_ = false;
  private color_ = vec3.fromValues(1.0, 1.0, 1.0);
  private sampleDensity_ = 255.0; // Samples per unit texture space
  private maxIntensity_ = 255.0; // Normalization factor for intensity
  private opacityScale_ = 0.1; // Alpha multiplier
  private alphaThreshold_ = 0.99; // Early ray termination threshold

  public get lod() {
    return this.lod_;
  }

  public set lod(value: number) {
    this.lod_ = value;
    this.clearObjects();
    this.updateChunks();
  }

  public get debugMode(): boolean {
    return this.debugMode_;
  }

  public set debugMode(debug: boolean) {
    this.debugMode_ = debug;
  }

  public get sourcePolicy(): Readonly<ImageSourcePolicy> {
    return this.sourcePolicy_;
  }

  public get hitMisses(): boolean {
    return this.hitMisses_;
  }

  public set hitMisses(showHitMiss: boolean) {
    this.hitMisses_ = showHitMiss;
  }

  public set sourcePolicy(newPolicy: ImageSourcePolicy) {
    if (this.sourcePolicy_ !== newPolicy) {
      this.sourcePolicy_ = newPolicy;
      if (this.chunkStoreView_) {
        this.chunkStoreView_.setImageSourcePolicy(
          newPolicy,
          INTERNAL_POLICY_KEY
        );
      }
    }
  }

  public get color(): vec3 {
    return this.color_;
  }

  public set color(newColor: vec3) {
    vec3.copy(this.color_, newColor);
  }

  public get sampleDensity(): number {
    return this.sampleDensity_;
  }

  public set sampleDensity(value: number) {
    this.sampleDensity_ = value;
  }

  public get maxIntensity(): number {
    return this.maxIntensity_;
  }

  public set maxIntensity(value: number) {
    this.maxIntensity_ = value;
  }

  public get opacityScale(): number {
    return this.opacityScale_;
  }
  public set opacityScale(value: number) {
    this.opacityScale_ = value;
  }

  public get alphaThreshold(): number {
    return this.alphaThreshold_;
  }
  public set alphaThreshold(value: number) {
    this.alphaThreshold_ = value;
  }

  private createVolume(chunk: Chunk) {
    const volume = new VolumeRenderable(
      chunk.shape.x,
      chunk.shape.y,
      chunk.shape.z,
      Texture3D.createWithChunk(chunk)
    );
    this.updateVolumeChunk(volume, chunk);
    return volume;
  }

  constructor({
    source,
    sliceCoords,
    policy,
    transparent = true,
    blendMode = "premultiplied",
    ...layerOptions
  }: VolumeLayerProps) {
    super({ transparent, blendMode, ...layerOptions });
    this.source_ = source;
    this.sliceCoords_ = sliceCoords;
    this.sourcePolicy_ = policy;
    this.setState("initialized");
  }

  private getVolumeForChunk(chunk: Chunk): VolumeRenderable {
    const existing = this.visibleChunks_.get(chunk);
    if (existing) return existing;

    const pooled = this.pool_.acquire(poolKeyForChunk(chunk));
    if (pooled) {
      const texture = pooled.textures[0] as Texture3D;
      texture.updateWithChunk(chunk);
      this.updateVolumeChunk(pooled, chunk);
      return pooled;
    }

    return this.createVolume(chunk);
  }

  public async onAttached(context: IdetikContext) {
    if (this.chunkStoreView_) {
      throw new Error(
        "VolumeLayer is already attached. " +
          "A layer cannot be attached to multiple contexts simultaneously."
      );
    }
    this.chunkStoreView_ = await context.chunkManager.addView(
      this.source_,
      this.sourcePolicy_
    );
  }

  public onDetached(context: IdetikContext): void {
    this.releaseAndRemoveChunks(this.visibleChunks_.keys());
    this.clearObjects();
    if (!this.chunkStoreView_) return;
    context.chunkManager.removeView(this.chunkStoreView_);
    this.chunkStoreView_ = undefined;
  }

  private getChunksToRender(): Chunk[] {
    if (!this.chunkStoreView_) return [];

    // Initialize LOD to coarsest if not set
    if (this.lod_ === -1) {
      this.lod_ = this.chunkStoreView_.store.getLowestResLOD();
    }

    // Get all chunks at the current timepoint
    const timeIndex = this.chunkStoreView_.store.getTimeIndex(
      this.sliceCoords_
    );
    const allChunks = this.chunkStoreView_.store.getChunksAtTime(timeIndex);

    // Filter for desired LOD, loaded state, and matching channel
    return allChunks.filter((chunk) => {
      const isDesiredLOD = chunk.lod === this.lod_;
      const isLoaded = chunk.state === "loaded";
      const isChannelMatch =
        this.sliceCoords_.c === undefined ||
        chunk.chunkIndex.c === this.sliceCoords_.c;
      return isDesiredLOD && isLoaded && isChannelMatch;
    });
  }

  private updateChunks() {
    if (!this.chunkStoreView_) return;

    const chunksToRender = this.getChunksToRender();

    // Check if we need to update
    const currentTime = this.sliceCoords_.t ?? -1;
    const needsUpdate =
      this.lastLoadedLod_ !== this.lod_ ||
      this.lastLoadedTime_ !== currentTime ||
      chunksToRender.length !== this.visibleChunks_.size;

    if (!needsUpdate) return;

    // Clear and rebuild visible chunks
    const currentChunkSet = new Set(chunksToRender);
    const chunksToRemove = Array.from(this.visibleChunks_.keys()).filter(
      (chunk) => !currentChunkSet.has(chunk)
    );
    this.releaseAndRemoveChunks(chunksToRemove);

    this.clearObjects();
    for (const chunk of chunksToRender) {
      const volume = this.getVolumeForChunk(chunk);
      volume.wireframeEnabled = this.debugMode;
      this.visibleChunks_.set(chunk, volume);
      this.addObject(volume);
    }

    this.lastLoadedLod_ = this.lod_;
    this.lastLoadedTime_ = currentTime;

    if (this.state !== "ready") this.setState("ready");
  }

  private updateVolumeChunk(volume: VolumeRenderable, chunk: Chunk) {
    volume.transform.setScale([chunk.scale.x, chunk.scale.y, chunk.scale.z]);
    const originOffset = {
      x: (chunk.shape.x * chunk.scale.x) / 2,
      y: (chunk.shape.y * chunk.scale.y) / 2,
      z: (chunk.shape.z * chunk.scale.z) / 2,
    };
    volume.transform.setTranslation([
      chunk.offset.x + originOffset.x,
      chunk.offset.y + originOffset.y,
      chunk.offset.z + originOffset.z,
    ]);
  }

  private releaseAndRemoveChunks(chunks: Iterable<Chunk>) {
    for (const chunk of chunks) {
      const volume = this.visibleChunks_.get(chunk);
      if (volume) {
        this.pool_.release(poolKeyForChunk(chunk), volume);
        this.visibleChunks_.delete(chunk);
      }
    }
  }

  public update(_context?: RenderContext) {
    if (!this.chunkStoreView_) return;

    // Initialize LOD to coarsest if not set
    if (this.lod_ === -1) {
      this.lod_ = this.chunkStoreView_.store.getLowestResLOD();
    }

    // Mark chunks for the desired LOD as visible
    this.chunkStoreView_.updateChunkStatesForVolume(
      this.sliceCoords_,
      this.lod_
    );

    this.updateChunks();
  }

  public getUniforms(): Record<string, unknown> {
    return {
      ShowHitMisses: Number(this.hitMisses),
      SampleDensity: this.sampleDensity,
      MaxIntensity: this.maxIntensity,
      OpacityScale: this.opacityScale,
      VolumeColor: this.color_,
      AlphaThreshold: this.alphaThreshold,
    };
  }
}

export function poolKeyForChunk(chunk: Chunk) {
  return [
    `lod${chunk.lod}`,
    `shape${chunk.shape.x}x${chunk.shape.y}`,
    `align${chunk.rowAlignmentBytes}`,
  ].join(":");
}
