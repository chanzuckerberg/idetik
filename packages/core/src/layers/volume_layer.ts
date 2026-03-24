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
import { Box3 } from "@/math/box3";

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
  private readonly currentVolumes_: Map<string, VolumeRenderable> = new Map();
  private readonly volumeToPoolKey_: Map<VolumeRenderable, string> = new Map();
  private readonly pool_ = new RenderablePool<VolumeRenderable>();
  private readonly initialChannelProps_?: ChannelProps[];
  private readonly channelChangeCallbacks_: Array<() => void> = [];

  private sourcePolicy_: ImageSourcePolicy;
  private chunkStoreView_?: ChunkStoreView;
  private channelProps_?: ChannelProps[];
  private clipBounds_?: Box3;

  private lastLoadedTime_: number | undefined = undefined;
  private lastNumRenderedChannelChunks_: number | undefined = undefined;
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
    for (const volume of this.currentVolumes_.values()) {
      volume.wireframeEnabled = value;
    }
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

  public setClipBounds(min?: vec3, max?: vec3) {
    const minBound = min
      ? vec3.clone(min)
      : vec3.fromValues(-Infinity, -Infinity, -Infinity);
    const maxBound = max
      ? vec3.clone(max)
      : vec3.fromValues(Infinity, Infinity, Infinity);
    if (!this.clipBounds_) {
      this.clipBounds_ = new Box3(minBound, maxBound);
    } else {
      this.clipBounds_.min = minBound;
      this.clipBounds_.max = maxBound;
    }
    for (const volume of this.currentVolumes_.values()) {
      volume.clipVolumeToBounds(this.clipBounds_);
    }
  }

  public setChannelProps(channelProps: ChannelProps[]) {
    this.channelProps_ = channelProps;
    for (const volume of this.currentVolumes_.values()) {
      volume.setChannelProps(channelProps);
    }
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

  constructor({ source, sliceCoords, policy, channelProps }: VolumeLayerProps) {
    super({ transparent: true, blendMode: "premultiplied" });
    this.source_ = source;
    this.sliceCoords_ = sliceCoords;
    this.sourcePolicy_ = policy;
    this.initialChannelProps_ = channelProps;
    this.channelProps_ = channelProps;
    this.setState("initialized");
  }

  private getOrCreateVolume(key: string, chunks: Chunk[]): VolumeRenderable {
    const existing = this.currentVolumes_.get(key);
    if (existing) {
      for (const chunk of chunks) existing.updateVolumeWithChunk(chunk);
      return existing;
    }

    const poolKey = poolKeyForChunk(chunks[0]);
    const volume = this.pool_.acquire(poolKey) ?? new VolumeRenderable();
    volume.setChannelProps(this.channelProps_ ?? []);
    this.volumeToPoolKey_.set(volume, poolKey);

    for (const chunk of chunks) volume.updateVolumeWithChunk(chunk);
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
    this.releaseAndRemoveVolumes(this.currentVolumes_.values());
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
    const groupedChunks = groupBySpatialIndex(chunksToRender);

    const needsUpdate =
      this.lastLoadedTime_ !== currentTime ||
      groupedChunks.size !== this.currentVolumes_.size ||
      this.lastNumRenderedChannelChunks_ !== chunksToRender.length;
    this.lastNumRenderedChannelChunks_ = chunksToRender.length;
    if (!needsUpdate) return;

    const volumesToRemove = Array.from(this.currentVolumes_.entries())
      .filter(([key]) => !groupedChunks.has(key))
      .map(([, volume]) => volume);
    this.releaseAndRemoveVolumes(volumesToRemove);

    this.currentVolumes_.clear();
    this.clearObjects();

    for (const [key, chunks] of groupedChunks) {
      const volume = this.getOrCreateVolume(key, chunks);
      if (this.clipBounds_) volume.clipVolumeToBounds(this.clipBounds_);
      volume.wireframeEnabled = this.debugShowWireframes;
      this.currentVolumes_.set(key, volume);
      this.addObject(volume);
    }

    this.lastLoadedTime_ = currentTime;
    if (this.state !== "ready") this.setState("ready");
  }

  private releaseAndRemoveVolumes(volumes: Iterable<VolumeRenderable>) {
    for (const volume of volumes) {
      volume.clearLoadedChannels();
      this.pool_.release(this.volumeToPoolKey_.get(volume)!, volume);
      this.volumeToPoolKey_.delete(volume);
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
    sortFrontToBack(this.objects, context.viewport.camera);
  }

  public getUniforms(): Record<string, unknown> {
    return {
      DebugShowDegenerateRays: Number(this.debugShowDegenerateRays),
      RelativeStepSize: this.relativeStepSize * this.interactiveStepSizeScale_,
      OpacityMultiplier: this.opacityMultiplier,
      EarlyTerminationAlpha: this.earlyTerminationAlpha,
    };
  }
}

function spatialKey(chunk: Chunk): string {
  const { x, y, z, t } = chunk.chunkIndex;
  return `${x}:${y}:${z}:${t}`;
}

function groupBySpatialIndex(chunks: Chunk[]): Map<string, Chunk[]> {
  const grouped = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const key = spatialKey(chunk);
    let group = grouped.get(key);
    if (!group) {
      group = [];
      grouped.set(key, group);
    }
    group.push(chunk);
  }
  return grouped;
}

export function poolKeyForChunk(chunk: Chunk) {
  return [
    `lod${chunk.lod}`,
    `shape${chunk.shape.x}x${chunk.shape.y}x${chunk.shape.z}`,
    `align${chunk.rowAlignmentBytes}`,
  ].join(":");
}
