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
import { Logger } from "../utilities/logger";

export type VolumeLayerProps = LayerOptions & {
  source: ChunkSource;
  sliceCoords: SliceCoordinates;
  policy: ImageSourcePolicy;
};

export class VolumeLayer extends Layer {
  public readonly type = "VolumeLayer";

  private readonly source_: ChunkSource;
  private readonly sliceCoords_: SliceCoordinates;
  private readonly visibleChunks_: Map<Chunk, VolumeRenderable> = new Map();

  private sourcePolicy_: ImageSourcePolicy;
  private chunkManagerSource_?: ChunkManagerSource;
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
    ...layerOptions
  }: VolumeLayerProps) {
    super(layerOptions);
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
  }

  public onDetached(): void {
    this.chunkManagerSource_ = undefined;
    this.releaseAndRemoveChunks(this.visibleChunks_.keys());
    this.clearObjects();
  }

  // Should ideally use chunk manager for this
  private loadChunks() {
    if (!this.chunkManagerSource_) return;
    if (this.lod_ === -1) {
      this.lod_ = this.chunkManagerSource_.lodCount - 1;
    }
    const chunks = this.chunkManagerSource_.getAllChunksAtLod(this.lod_);
    if (
      this.lastLoadedLod_ === this.lod_ &&
      this.lastLoadedTime_ === this.sliceCoords_.t
    )
      return chunks;
    Logger.debug("VolumeLayer", `Loading chunks for LOD ${this.lod_}`);
    for (const chunk of chunks) {
      this.chunkManagerSource_.loadChunkData(
        chunk,
        new AbortController().signal
      );
    }
    this.lastLoadedLod_ = this.lod_;
    this.lastLoadedTime_ = this.sliceCoords_.t ?? -1;
    return chunks;
  }

  private updateChunks() {
    const chunks = this.loadChunks();
    if (!chunks) return;
    for (const chunk of chunks) {
      // TODO should be able to use loaded state later
      if (!chunk.data) continue;
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
