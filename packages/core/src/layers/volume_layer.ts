import { Chunk, ChunkSource, SliceCoordinates } from "../data/chunk";
import { Layer, LayerOptions } from "../core/layer";
import { VolumeRenderable } from "../objects/renderable/volume_renderable";
import { IdetikContext } from "../idetik";
import { ChunkManagerSource } from "../core/chunk_manager_source";
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

  private policy_: ImageSourcePolicy;
  private chunkManagerSource_?: ChunkManagerSource;
  private lod_ = 2;
  private debugMode_ = false;

  private lastLoadedLod_ = -1;

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
    this.policy_ = policy;

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
      this.policy_
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
    const chunks = this.chunkManagerSource_.getAllChunksAtRes(this.lod_);
    if (this.lastLoadedLod_ === this.lod_) return chunks;
    this.lastLoadedLod_ = this.lod_;
    Logger.debug("VolumeLayer", `Loading chunks for LOD ${this.lod_}`);
    for (const chunk of chunks) {
      chunk.visible = true;
      this.chunkManagerSource_.loadChunkData(
        chunk,
        new AbortController().signal
      );
    }
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
