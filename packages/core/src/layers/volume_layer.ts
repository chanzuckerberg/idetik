import { Chunk, ChunkSource, SliceCoordinates } from "../data/chunk";
import { Layer, RenderContext } from "../core/layer";
import { VolumeRenderable } from "../objects/renderable/volume_renderable";
import { IdetikContext } from "../idetik";
import { ChunkStoreView, INTERNAL_POLICY_KEY } from "../core/chunk_store_view";
import { ImageSourcePolicy } from "../core/image_source_policy";
import { RenderablePool } from "../utilities/renderable_pool";
import { vec3 } from "gl-matrix";
import { sortFrontToBack } from "../math/sort_by_distance";
import { ChannelProps, ChannelsEnabled } from "../objects/textures/channel";

export type VolumeLayerProps = {
  source: ChunkSource;
  sliceCoords: SliceCoordinates;
  policy: ImageSourcePolicy;
  channelProps?: ChannelProps[];
};

const INTERACTIVE_STEP_SIZE_SCALE = 2.0;

export class VolumeLayer extends Layer implements ChannelsEnabled {
  public readonly type = "VolumeLayer";

  private readonly source_: ChunkSource;
  private readonly sliceCoords_: SliceCoordinates;
  private readonly currentChunks_: Map<Chunk, VolumeRenderable> = new Map();
  private readonly pool_ = new RenderablePool<VolumeRenderable>();
  private readonly initialChannelProps_?: ChannelProps[];
  private readonly channelChangeCallbacks_: Array<() => void> = [];

  private sourcePolicy_: ImageSourcePolicy;
  private chunkStoreView_?: ChunkStoreView;
  private channelProps_?: ChannelProps[];

  private lastLoadedTime_: number | undefined = undefined;
  private interactiveStepSizeScale_ = 1.0;

  // TODO: Make a debug config object to manage debug options
  private debugShowWireframes_ = false;
  public debugShowDegenerateRays = false;
  public relativeStepSize = 1.0;
  public opacityMultiplier = 1.0;
  public earlyTerminationAlpha = 0.99;

  public get debugShowWireframes() {
    return this.debugShowWireframes_;
  }

  public set debugShowWireframes(value: boolean) {
    if (this.debugShowWireframes_ === value) return;
    this.currentVolumes().forEach((volume) => {
      volume.wireframeEnabled = value;
    });
    this.debugShowWireframes_ = value;
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

  public setChannelProps(channelProps: ChannelProps[]) {
    this.channelProps_ = channelProps;
    this.currentVolumes().forEach((volume) => {
      volume.setChannelProps(channelProps);
    });
    this.channelChangeCallbacks_.forEach((callback) => {
      callback();
    });
  }

  public get channelProps(): ChannelProps[] | undefined {
    return this.channelProps_;
  }

  public resetChannelProps(): void {
    if (this.initialChannelProps_ !== undefined) {
      this.setChannelProps(this.initialChannelProps_);
    }
  }

  public addChannelChangeCallback(callback: () => void): void {
    this.channelChangeCallbacks_.push(callback);
  }

  public removeChannelChangeCallback(callback: () => void): void {
    const index = this.channelChangeCallbacks_.indexOf(callback);
    if (index === undefined) {
      throw new Error(`Callback to remove could not be found: ${callback}`);
    }
    this.channelChangeCallbacks_.splice(index, 1);
  }

  private currentVolumes(): Set<VolumeRenderable> {
    return new Set(this.currentChunks_.values());
  }

  constructor({ source, sliceCoords, policy, channelProps }: VolumeLayerProps) {
    super({ transparent: true, blendMode: "premultiplied" });
    this.source_ = source;
    this.sliceCoords_ = sliceCoords;
    this.sourcePolicy_ = policy;
    this.initialChannelProps_ = channelProps;
    this.channelProps_ = channelProps;
    this.setState("initialized");
  }

  private getVolumeForChunk(chunk: Chunk): VolumeRenderable {
    // 1. If the chunk is already in the currentChunks_, return it.
    const existing = this.currentChunks_.get(chunk);
    if (existing) return existing;

    // 2. If a volume for the same chunk index exists, add this channel to it
    for (const [existingChunk, volume] of this.currentChunks_) {
      if (
        existingChunk.chunkIndex.x === chunk.chunkIndex.x &&
        existingChunk.chunkIndex.y === chunk.chunkIndex.y &&
        existingChunk.chunkIndex.z === chunk.chunkIndex.z &&
        existingChunk.chunkIndex.t === chunk.chunkIndex.t
      ) {
        volume.updateVolumeWithChunk(chunk);
        return volume;
      }
    }

    // 3. Acquire pooled volume or create new one
    let volume = this.pool_.acquire(poolKeyForChunk(chunk));
    if (volume && this.channelProps_) {
      volume.setChannelProps(this.channelProps_);
    } else {
      volume = new VolumeRenderable(this.channelProps_);
    }

    volume.updateVolumeWithChunk(chunk);
    this.updateVolumeTransform(volume, chunk);
    return volume;
  }

  public async onAttached(context: IdetikContext) {
    this.chunkStoreView_ = await context.chunkManager.addView(
      this.source_,
      this.sourcePolicy_
    );
  }

  public onDetached(_context: IdetikContext): void {
    if (!this.chunkStoreView_) return;
    this.releaseAndRemoveChunks(this.currentChunks_.keys());
    this.clearObjects();
    this.chunkStoreView_.dispose();
    this.chunkStoreView_ = undefined;
  }

  private updateChunks() {
    if (!this.chunkStoreView_) return;

    const chunksToRender = this.chunkStoreView_.getChunksToRender(
      this.sliceCoords_
    );
    const currentTime = this.sliceCoords_.t ?? -1;
    const needsUpdate =
      this.lastLoadedTime_ !== currentTime ||
      chunksToRender.length !== this.currentChunks_.size;
    if (!needsUpdate) return;

    const newChunkSet = new Set(chunksToRender);
    const chunksToRemove = Array.from(this.currentChunks_.keys()).filter(
      (chunk) => !newChunkSet.has(chunk)
    );
    this.releaseAndRemoveChunks(chunksToRemove);

    this.clearObjects();
    for (const chunk of chunksToRender) {
      const volume = this.getVolumeForChunk(chunk);
      volume.wireframeEnabled = this.debugShowWireframes;
      this.currentChunks_.set(chunk, volume);
    }

    this.currentVolumes().forEach((volume) => {
      this.addObject(volume);
    });

    this.lastLoadedTime_ = currentTime;
    if (this.state !== "ready") this.setState("ready");
  }

  private updateVolumeTransform(volume: VolumeRenderable, chunk: Chunk) {
    const worldSize = {
      x: chunk.shape.x * chunk.scale.x,
      y: chunk.shape.y * chunk.scale.y,
      z: chunk.shape.z * chunk.scale.z,
    };
    volume.transform.setScale([worldSize.x, worldSize.y, worldSize.z]);
    vec3.set(volume.voxelScale, chunk.scale.x, chunk.scale.y, chunk.scale.z);
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

  private updateVolumeUniforms() {
    for (const volume of this.currentVolumes()) {
      volume.debugShowDegenerateRays = this.debugShowDegenerateRays;
      volume.relativeStepSize =
        this.relativeStepSize * this.interactiveStepSizeScale_;
      volume.opacityMultiplier = this.opacityMultiplier;
      volume.earlyTerminationAlpha = this.earlyTerminationAlpha;
    }
  }

  private releaseAndRemoveChunks(chunks: Iterable<Chunk>) {
    const releasedVolumes = new Set<VolumeRenderable>();
    for (const chunk of chunks) {
      const volume = this.currentChunks_.get(chunk);
      if (volume && !releasedVolumes.has(volume)) {
        volume.clearLoadedChannels();
        this.pool_.release(poolKeyForChunk(chunk), volume);
        releasedVolumes.add(volume);
      }
      this.currentChunks_.delete(chunk);
    }
  }

  public update(context?: RenderContext) {
    if (!this.chunkStoreView_) return;
    if (context === undefined) {
      throw new Error(
        "RenderContext is required for the VolumeLayer update as camera information is used to reorder the chunks."
      );
    }

    this.chunkStoreView_.updateChunksForVolume(
      this.sliceCoords_,
      context.viewport
    );

    const isCameraMoving = context.viewport.cameraControls?.isMoving ?? false;
    this.interactiveStepSizeScale_ = isCameraMoving
      ? INTERACTIVE_STEP_SIZE_SCALE
      : 1.0;

    this.updateChunks();
    this.updateVolumeUniforms();
    sortFrontToBack(this.objects, context.viewport.camera);
  }
}

export function poolKeyForChunk(chunk: Chunk) {
  return [
    `lod${chunk.lod}`,
    `shape${chunk.shape.x}x${chunk.shape.y}x${chunk.shape.z}`,
    `align${chunk.rowAlignmentBytes}`,
  ].join(":");
}
