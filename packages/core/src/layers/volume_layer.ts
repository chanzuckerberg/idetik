import { Chunk, ChunkSource, SliceCoordinates } from "../data/chunk";
import { Layer, LayerOptions, RenderContext } from "../core/layer";
import { VolumeRenderable } from "../objects/renderable/volume_renderable";
import { IdetikContext } from "../idetik";
import { ChunkStoreView, INTERNAL_POLICY_KEY } from "../core/chunk_store_view";
import { ImageSourcePolicy } from "../core/image_source_policy";
import { Texture3D } from "../objects/textures/texture_3d";
import { RenderablePool } from "../utilities/renderable_pool";
import { glMatrix, vec3 } from "gl-matrix";
import { Camera } from "../objects/cameras/camera";
import { ChannelProps, ChannelsEnabled } from "../objects/textures/channel";

export type VolumeLayerProps = LayerOptions & {
  source: ChunkSource;
  sliceCoords: SliceCoordinates;
  policy: ImageSourcePolicy;
  lod?: number;
  channelProps?: ChannelProps[];
};

export type OrderingMode = "front-to-back" | "back-to-front";

export class VolumeLayer extends Layer implements ChannelsEnabled {
  public readonly type = "VolumeLayer";

  private readonly source_: ChunkSource;
  private readonly sliceCoords_: SliceCoordinates;
  private readonly currentChunks_: Map<Chunk, VolumeRenderable> = new Map();
  private readonly pool_ = new RenderablePool<VolumeRenderable>();
  private readonly initialChannelProps_?: ChannelProps[];
  private readonly channelChangeCallbacks_: Array<() => void> = [];
  private channelProps_?: ChannelProps[];

  private sourcePolicy_: ImageSourcePolicy;
  private chunkStoreView_?: ChunkStoreView;

  private lastLoadedTime_: number | undefined = undefined;
  // TODO: Make a debug config object to manage debug options
  private debugShowWireframes_ = false;
  public debugShowDegenerateRays = false;
  public color = vec3.fromValues(1.0, 1.0, 1.0);
  public relativeStepSize = 1.0;
  public maxIntensity = 255.0;
  public opacityMultiplier = 1.0;
  public earlyTerminationAlpha = 0.99;

  public get debugShowWireframes() {
    return this.debugShowWireframes_;
  }

  public set debugShowWireframes(value: boolean) {
    if (this.debugShowWireframes_ === value) return;
    for (const volume of this.currentChunks_.values()) {
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

  private createVolume(chunk: Chunk) {
    const volume = new VolumeRenderable(
      Texture3D.createWithChunk(chunk),
      chunk.chunkIndex.c,
      this.channelProps_
    );
    this.updateVolumeChunk(volume, chunk);
    return volume;
  }

  constructor({ source, sliceCoords, policy, channelProps }: VolumeLayerProps) {
    super({ transparent: true, blendMode: "premultiplied" });
    this.source_ = source;
    this.sliceCoords_ = sliceCoords;
    this.sourcePolicy_ = policy;
    this.channelProps_ = channelProps;
    this.initialChannelProps_ = channelProps;
    this.setState("initialized");
  }

  public get channelProps(): ChannelProps[] | undefined {
    return this.channelProps_;
  }

  public setChannelProps(channelProps: ChannelProps[]) {
    this.channelProps_ = channelProps;
    this.currentChunks_.forEach((chunk) => {
      chunk.setChannelProps(channelProps);
    });
    this.channelChangeCallbacks_.forEach((callback) => {
      callback();
    });
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
    if (index === -1) {
      throw new Error(`Callback to remove could not be found: ${callback}`);
    }
    this.channelChangeCallbacks_.splice(index, 1);
  }

  private getVolumeForChunk(chunk: Chunk): VolumeRenderable {
    const existing = this.currentChunks_.get(chunk);
    if (existing) return existing;

    // Add texture as new channel to existing volume if match
    for (const [existingChunk, volume] of this.currentChunks_) {
      if (poolKeyForChunk(existingChunk) === poolKeyForChunk(chunk)) {
        volume.setTexture(chunk.chunkIndex.c, Texture3D.createWithChunk(chunk));
        return volume;
      }
    }

    const pooled = this.pool_.acquire(poolKeyForChunk(chunk));
    if (pooled) {
      const chunkIndex = chunk.chunkIndex.c;
      const texture = pooled.textures[chunkIndex] as Texture3D;
      texture.updateWithChunk(chunk);
      this.updateVolumeChunk(pooled, chunk);
      return pooled;
    }

    return this.createVolume(chunk);
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
    const numChunksToRender = chunksToRender.length;

    const currentTime = this.sliceCoords_.t ?? -1;
    const needsUpdate =
      this.lastLoadedTime_ !== currentTime ||
      numChunksToRender !== this.currentChunks_.size;
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
    const seenKeys = new Set<string>();
    this.currentChunks_.forEach((volume, chunk) => {
      const key = poolKeyForChunk(chunk);
      if (!seenKeys.has(key)) {
        this.addObject(volume);
        seenKeys.add(key);
      }
    });

    this.lastLoadedTime_ = currentTime;
    if (this.state !== "ready") this.setState("ready");
  }

  private updateVolumeChunk(volume: VolumeRenderable, chunk: Chunk) {
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

  private releaseAndRemoveChunks(chunks: Iterable<Chunk>) {
    for (const chunk of chunks) {
      const volume = this.currentChunks_.get(chunk);
      if (volume) {
        this.pool_.release(poolKeyForChunk(chunk), volume);
        this.currentChunks_.delete(chunk);
      }
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
    this.updateChunks();
    this.reorderObjects(context.viewport.camera);
  }

  public reorderObjects(camera: Camera) {
    // TODO: We should be able to skip this sorting if the camera hasn't moved since the last frame, but that requires tracking the camera position and/or orientation.
    const cameraPos = camera.position;
    const centerA = vec3.create();
    const centerB = vec3.create();

    this.objects.sort((a, b) => {
      vec3.add(centerA, a.boundingBox.max, a.boundingBox.min);
      vec3.scale(centerA, centerA, 0.5);

      vec3.add(centerB, b.boundingBox.max, b.boundingBox.min);
      vec3.scale(centerB, centerB, 0.5);

      const cam2aDistance = vec3.squaredDistance(cameraPos, centerA);
      const cam2bDistance = vec3.squaredDistance(cameraPos, centerB);
      const diff = cam2aDistance - cam2bDistance;

      if (Math.abs(diff) < glMatrix.EPSILON) {
        return 0;
      }

      return diff;
    });
  }

  public getUniforms(): Record<string, unknown> {
    return {
      DebugShowDegenerateRays: Number(this.debugShowDegenerateRays),
      RelativeStepSize: this.relativeStepSize,
      OpacityMultiplier: this.opacityMultiplier,
      EarlyTerminationAlpha: this.earlyTerminationAlpha,
    };
  }
}

function poolKeyForChunk(chunk: Chunk) {
  return [
    `lod${chunk.lod}`,
    `shape${chunk.shape.x}x${chunk.shape.y}x${chunk.shape.z}`,
    `locationx${chunk.chunkIndex.x}y${chunk.chunkIndex.y}z${chunk.chunkIndex.z}t${chunk.chunkIndex.t}`,
    `align${chunk.rowAlignmentBytes}`,
  ].join(":");
}
