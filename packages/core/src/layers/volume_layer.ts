import { Chunk, ChunkSource, SliceCoordinates } from "../data/chunk";
import { Layer, LayerOptions, RenderContext } from "../core/layer";
import { VolumeRenderable } from "../objects/renderable/volume_renderable";
import { IdetikContext } from "../idetik";
import { ChunkStoreView, INTERNAL_POLICY_KEY } from "../core/chunk_store_view";
import { ImageSourcePolicy } from "../core/image_source_policy";
import { Texture3D } from "../objects/textures/texture_3d";

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

  private sourcePolicy_: ImageSourcePolicy;
  private chunkStoreView_?: ChunkStoreView;
  private lod_ = -1;
  private debugMode_ = false;

  private lastLoadedLod_ = -1;
  private lastLoadedTime_ = -1;

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

  private createVolume(chunk: Chunk) {
    const volume = new VolumeRenderable(
      chunk.shape.x,
      chunk.shape.y,
      chunk.shape.z,
      Texture3D.createWithChunk(chunk)
    );
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

  private getVolumeRenderableForChunk(chunk: Chunk): VolumeRenderable {
    const existing = this.visibleChunks_.get(chunk);
    if (existing) return existing;

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
    const timeIndex = this.chunkStoreView_.store.getTimeIndex(this.sliceCoords_);
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
      const volume = this.getVolumeRenderableForChunk(chunk);
      volume.wireframeEnabled = this.debugMode;
      this.visibleChunks_.set(chunk, volume);
      this.addObject(volume);
    }

    this.lastLoadedLod_ = this.lod_;
    this.lastLoadedTime_ = currentTime;

    if (this.state !== "ready") this.setState("ready");
  }

  private releaseAndRemoveChunks(chunks: Iterable<Chunk>) {
    for (const chunk of chunks) {
      const volume = this.visibleChunks_.get(chunk);
      if (volume) {
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
}
