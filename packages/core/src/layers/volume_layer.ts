import {
  Chunk,
  ChunkSource,
  SliceCoordinates,
  ChunkDataConstructor,
} from "../data/chunk";
import { Layer, LayerOptions, RenderContext } from "../core/layer";
import { VolumeRenderable } from "../objects/renderable/volume_renderable";
import { IdetikContext } from "../idetik";
import { ChunkStoreView, INTERNAL_POLICY_KEY } from "../core/chunk_store_view";
import { ImageSourcePolicy } from "../core/image_source_policy";
import { Texture3D } from "../objects/textures/texture_3d";
import { Texture3DArray } from "../objects/textures/texture_3d_array";
import { RenderablePool } from "../utilities/renderable_pool";
import { glMatrix, vec3 } from "gl-matrix";
import { Camera } from "@/objects/cameras/camera";
import { ChannelProps, ChannelsEnabled } from "@/objects/textures/channel";

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
  public samplesPerUnit = 128.0;
  public maxIntensity = 255.0;
  public opacityMultiplier = 0.2;
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
    const numChannels = this.chunkStoreView_?.getNumChannels() ?? 1;
    const texture = Texture3D.createWithChunk(chunk);
    const volume = new VolumeRenderable(
      texture,
      this.channelProps_ || this.getDefaultChannelProps(numChannels)
    );
    this.updateVolumeChunk(volume, chunk);
    return volume;
  }

  private getDefaultChannelProps(numChannels: number): ChannelProps[] {
    const props: ChannelProps[] = [];
    for (let i = 0; i < numChannels; i++) {
      props.push({
        visible: true,
        color: [1.0, 1.0, 1.0],
        contrastLimits: [0, this.maxIntensity],
      });
    }
    return props;
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

  private getVolumeForChunk(
    renderableChunks: Chunk[],
    chunkIndex: number
  ): VolumeRenderable | null {
    const chunk = renderableChunks[chunkIndex];
    const existing = this.currentChunks_.get(chunk);
    if (existing) return existing;
    this.setState("initialized");

    const numChannels = this.chunkStoreView_?.getNumChannels() ?? 1;
    let chunkToAdd = chunk;
    if (numChannels > 1) {
      // Find all the chunks which match the spatial coordinates of the current chunk
      // but have different channel indices, to create a larger 3D texture
      // which contains all channels for that spatial location.
      const matchingChunks = renderableChunks.filter((otherChunk) => {
        return (
          otherChunk.chunkIndex.x === chunk.chunkIndex.x &&
          otherChunk.chunkIndex.y === chunk.chunkIndex.y &&
          otherChunk.chunkIndex.z === chunk.chunkIndex.z &&
          otherChunk.lod === chunk.lod
        );
      });

      if (matchingChunks.length === numChannels) {
        chunkToAdd = { ...chunk };
        // Sort the matching chunks by channel index
        matchingChunks.sort((a, b) => a.chunkIndex.c - b.chunkIndex.c);
        // Combine the data from all matching chunks into a single chunk with multiple channels

        // Get the constructor of the first chunk's data to determine the data type
        const DataConstructor = matchingChunks[0].data!
          .constructor as ChunkDataConstructor;
        const totalElements =
          matchingChunks[0].shape.x *
          matchingChunks[0].shape.y *
          matchingChunks[0].shape.z *
          numChannels;

        // Create the combined data array with the same type as the source data
        const combinedData = new DataConstructor(totalElements);

        for (let c = 0; c < numChannels; c++) {
          const sourceData = matchingChunks[c].data!;
          const channelSize =
            matchingChunks[c].shape.x *
            matchingChunks[c].shape.y *
            matchingChunks[c].shape.z;
          combinedData.set(sourceData, c * channelSize);
        }

        chunkToAdd.data = combinedData;
        chunkToAdd.shape.z = chunkToAdd.shape.z * numChannels;
      } else {
        // We are still waiting on some channels to load, so we cannot create the volume yet.
        return null;
      }
    }

    const pooled = this.pool_.acquire(poolKeyForChunk(chunkToAdd));
    if (pooled) {
      const texture = pooled.textures[0] as Texture3DArray | Texture3D;
      texture.updateWithChunk(chunkToAdd);
      this.updateVolumeChunk(pooled, chunkToAdd);
      return pooled;
    }

    return this.createVolume(chunkToAdd);
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
    const numChannels = this.chunkStoreView_.getNumChannels();
    const numChunksToRender = chunksToRender.length / numChannels;

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
    for (let i = 0; i < numChunksToRender; i++) {
      const volume = this.getVolumeForChunk(chunksToRender, i);
      if (!volume) continue;
      volume.wireframeEnabled = this.debugShowWireframes;
      this.currentChunks_.set(chunksToRender[i], volume);
      this.addObject(volume);
    }

    this.lastLoadedTime_ = currentTime;

    if (this.state !== "ready") this.setState("ready");
  }

  private updateVolumeChunk(volume: VolumeRenderable, chunk: Chunk) {
    const numChannels = this.chunkStoreView_?.getNumChannels() ?? 1;
    const realChunkDepth = chunk.shape.z / numChannels;
    volume.transform.setScale([
      chunk.shape.x * chunk.scale.x,
      chunk.shape.y * chunk.scale.y,
      realChunkDepth * chunk.scale.z,
    ]);
    const originOffset = {
      x: (chunk.shape.x * chunk.scale.x) / 2,
      y: (chunk.shape.y * chunk.scale.y) / 2,
      z: (realChunkDepth * chunk.scale.z) / 2,
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
    } else {
      this.reorderObjects(context.viewport.camera);
    }

    this.chunkStoreView_.updateChunkStatesForVolume(this.sliceCoords_);
    this.updateChunks();
  }

  public reorderObjects(camera: Camera) {
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
      const diff = cam2bDistance - cam2aDistance;

      if (Math.abs(diff) < glMatrix.EPSILON) {
        return 0;
      }

      return diff;
    });
  }

  public getUniforms(): Record<string, unknown> {
    return {
      DebugShowDegenerateRays: Number(this.debugShowDegenerateRays),
      SamplesPerUnit: this.samplesPerUnit,
      MaxIntensity: this.maxIntensity,
      OpacityMultiplier: this.opacityMultiplier,
      VolumeColor: this.color,
      EarlyTerminationAlpha: this.earlyTerminationAlpha,
    };
  }
}

export function poolKeyForChunk(chunk: Chunk) {
  return [
    `lod${chunk.lod}`,
    `shape${chunk.shape.x}x${chunk.shape.y}x${chunk.shape.z}`,
    `channel${chunk.chunkIndex.c}`,
    `align${chunk.rowAlignmentBytes}`,
  ].join(":");
}
