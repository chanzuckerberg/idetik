import { Chunk, ChunkSource, SliceCoordinates } from "../data/chunk";
import { Layer, LayerOptions } from "../core/layer";
import { VolumeRenderable } from "../objects/renderable/volume_renderable";
import { IdetikContext } from "../idetik";
import {
  ChunkManagerSource,
  INTERNAL_POLICY_KEY,
} from "../core/chunk_manager_source";
import { ImageSourcePolicy } from "../core/image_source_policy";
import { Texture3D } from "../objects/textures/texture_3d";
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

  private sourcePolicy_: ImageSourcePolicy;
  private chunkManagerSource_?: ChunkManagerSource;
  private lod_ = -1;
  private debugMode_ = false;
  private hitMisses_ = false;
  private lastLoadedLod_ = -1;
  private lastLoadedTime_ = -1;
  private pendingLoads_: Map<Chunk, AbortController> = new Map();
  private color_ = vec3.fromValues(1.0, 1.0, 1.0);
  private sampleDensity_ = 128.0; // Samples per unit texture space
  private maxIntensity_ = 255.0; // Normalization factor for intensity
  private opacityScale_ = 0.1; // Alpha multiplier
  private alphaThreshold_ = 0.99; // Early ray termination threshold

  public get lod() {
    return this.lod_;
  }

  public set lod(value: number) {
    if (this.lod_ !== value) {
      // Cancel any pending loads from the previous LOD
      this.cancelPendingLoads();
      this.lod_ = value;
      this.clearObjects();
      this.updateChunks();
    }
  }

  public get debugMode(): boolean {
    return this.debugMode_;
  }

  public set debugMode(debug: boolean) {
    this.debugMode_ = debug;
  }

  public get hitMisses(): boolean {
    return this.hitMisses_;
  }

  public set hitMisses(showHitMisses: boolean) {
    this.hitMisses_ = showHitMisses;
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

  public get sourcePolicy(): Readonly<ImageSourcePolicy> {
    return this.sourcePolicy_;
  }

  public set sourcePolicy(newPolicy: ImageSourcePolicy) {
    if (this.sourcePolicy_ !== newPolicy) {
      this.sourcePolicy_ = newPolicy;
      if (this.chunkManagerSource_) {
        this.chunkManagerSource_.setImageSourcePolicy(
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
    if (this.chunkManagerSource_) {
      throw new Error(
        "ChunkedImageLayer is already attached. " +
          "A layer cannot be attached to multiple LayerManagers simultaneously."
      );
    }
    this.chunkManagerSource_ = await context.chunkManager.addSource(
      this.source_,
      this.sliceCoords_,
      this.sourcePolicy_
    );
    // Initialize and start loading chunks
    if (this.lod_ === -1) {
      this.lod_ = this.chunkManagerSource_.lodCount - 1;
    }
    this.updateChunks();
  }

  public onDetached(): void {
    this.cancelPendingLoads();
    this.chunkManagerSource_ = undefined;
    this.releaseAndRemoveChunks(this.visibleChunks_.keys());
    this.clearObjects();
  }

  private cancelPendingLoads() {
    if (this.pendingLoads_.size > 0) {
      for (const [chunk, controller] of this.pendingLoads_) {
        controller.abort();
        // Reset chunk state
        if (chunk.state === "loading") {
          chunk.state = "unloaded";
        }
      }
      this.pendingLoads_.clear();
    }
  }

  // Load all chunks at the current LOD for volume rendering
  private loadChunks() {
    if (!this.chunkManagerSource_) return;
    if (this.lod_ === -1) {
      this.lod_ = this.chunkManagerSource_.lodCount - 1;
    }
    const chunks = this.chunkManagerSource_.getAllChunksAtLod(this.lod_);

    const needsNewLoads =
      this.lastLoadedLod_ !== this.lod_ ||
      this.lastLoadedTime_ !== (this.sliceCoords_.t ?? -1);

    if (needsNewLoads) {
      this.cancelPendingLoads();

      this.clearObjects();
      this.releaseAndRemoveChunks(this.visibleChunks_.keys());

      for (const chunk of chunks) {
        if (chunk.state === "loaded") continue;

        const controller = new AbortController();
        this.pendingLoads_.set(chunk, controller);

        chunk.state = "loading";

        this.chunkManagerSource_
          .loadChunkData(chunk, controller.signal)
          .then(() => {
            chunk.state = "loaded";
            this.pendingLoads_.delete(chunk);
          })
          .catch((err) => {
            chunk.state = "unloaded";
            this.pendingLoads_.delete(chunk);
            if (err.name !== "AbortError") {
              console.error("Chunk load error:", err);
            }
          });
      }

      this.lastLoadedLod_ = this.lod_;
      this.lastLoadedTime_ = this.sliceCoords_.t ?? -1;
    }

    return chunks;
  }

  private updateChunks() {
    const chunks = this.loadChunks();
    if (!chunks) return;

    // Add newly loaded chunks to the scene
    for (const chunk of chunks) {
      if (chunk.state !== "loaded" || !chunk.data) continue;
      if (this.visibleChunks_.has(chunk)) continue;
      const volume = this.getVolumeRenderableForChunk(chunk);
      volume.wireframeEnabled = this.debugMode;
      this.visibleChunks_.set(chunk, volume);
      this.addObject(volume);
    }

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

  public update() {
    this.updateChunks();
  }
}
