import { Chunk, ChunkSource, SliceCoordinates } from "../data/chunk";
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
import { Logger } from "@/utilities/logger";

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
  private readonly visibleChunks_: Map<Chunk, VolumeRenderable> = new Map();
  private readonly pool_ = new RenderablePool<VolumeRenderable>();
  private readonly initialChannelProps_?: ChannelProps[];
  private readonly channelChangeCallbacks_: Array<() => void> = [];
  private channelProps_?: ChannelProps[];

  private sourcePolicy_: ImageSourcePolicy;
  private chunkStoreView_?: ChunkStoreView;
  private lod_ = 0;
  private debugMode_ = false;

  private lastLoadedLod_ = -1;
  private lastLoadedTime_ = -1;
  public showEmptyRays = false;
  private color_ = vec3.fromValues(1.0, 1.0, 1.0);
  public sampleDensity = 128.0; // Samples per unit texture space
  public maxIntensity = 255.0; // Normalization factor for intensity
  public opacityScale = 1.0; // Alpha multiplier
  public alphaThreshold = 0.99; // Early ray termination threshold

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

  public set debugMode(value: boolean) {
    this.debugMode_ = value;
    for (const volume of this.visibleChunks_.values()) {
      volume.wireframeEnabled = value;
    }
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

  public get color(): vec3 {
    return this.color_;
  }

  public set color(newColor: vec3) {
    vec3.copy(this.color_, newColor);
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

  constructor({
    source,
    sliceCoords,
    policy,
    lod = 0,
    channelProps,
  }: VolumeLayerProps) {
    // Volume rendering is always transparent with fixed blend mode
    super({ transparent: true, blendMode: "premultiplied" });
    this.source_ = source;
    this.sliceCoords_ = sliceCoords;
    this.sourcePolicy_ = policy;
    this.lod_ = lod;
    this.channelProps_ = channelProps;
    this.initialChannelProps_ = channelProps;
    this.setState("initialized");
  }

  public get channelProps(): ChannelProps[] | undefined {
    return this.channelProps_;
  }

  public setChannelProps(channelProps: ChannelProps[]) {
    this.channelProps_ = channelProps;
    this.visibleChunks_.forEach((chunk) => {
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
    const existing = this.visibleChunks_.get(chunk);
    if (existing) return existing;

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
        // TODO fix to handle different data types
        const combinedData = new Float32Array(
          matchingChunks[0].shape.x *
            matchingChunks[0].shape.y *
            matchingChunks[0].shape.z *
            numChannels
        );
        for (let c = 0; c < numChannels; c++) {
          const sourceData = matchingChunks[c].data as Float32Array;
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
    this.releaseAndRemoveChunks(this.visibleChunks_.keys());
    this.clearObjects();
    if (!this.chunkStoreView_) return;
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
      this.lastLoadedLod_ !== this.lod_ ||
      this.lastLoadedTime_ !== currentTime ||
      numChunksToRender !== this.visibleChunks_.size;

    if (!needsUpdate) return;

    // Clear and rebuild visible chunks
    const currentChunkSet = new Set(chunksToRender);
    const chunksToRemove = Array.from(this.visibleChunks_.keys()).filter(
      (chunk) => !currentChunkSet.has(chunk)
    );
    this.releaseAndRemoveChunks(chunksToRemove);

    this.clearObjects();
    for (let i = 0; i < numChunksToRender; i++) {
      const volume = this.getVolumeForChunk(chunksToRender, i);
      if (!volume) continue;
      volume.wireframeEnabled = this.debugMode;
      this.visibleChunks_.set(chunksToRender[i], volume);
      this.addObject(volume);
    }

    this.lastLoadedLod_ = this.lod_;
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
      const volume = this.visibleChunks_.get(chunk);
      if (volume) {
        this.pool_.release(poolKeyForChunk(chunk), volume);
        this.visibleChunks_.delete(chunk);
      }
    }
  }

  public update(_context?: RenderContext) {
    if (!this.chunkStoreView_) return;

    this.chunkStoreView_.updateChunkStatesForVolume(
      this.sliceCoords_,
      this.lod_
    );

    this.updateChunks();
    if (_context === undefined) {
      throw new Error(
        "RenderContext is required for the VolumeLayer update as camera information is used to reorder the chunks."
      );
    } else {
      this.reorderObjects(_context.viewport.camera, "front-to-back");
      if (this.objects.length > 0) {
        Logger.debug(
          "VolumeLayer",
          "Reordered objects",
          this.objects[0].boundingBox
        );
      }
    }
  }

  public reorderObjects(camera: Camera, mode: OrderingMode) {
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

      return mode === "front-to-back" ? diff : -diff;
    });
  }

  public getUniforms(): Record<string, unknown> {
    return {
      ShowEmptyRays: Number(this.showEmptyRays),
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
    `shape${chunk.shape.x}x${chunk.shape.y}x${chunk.shape.z}`,
    `channel${chunk.chunkIndex.c}`,
    `align${chunk.rowAlignmentBytes}`,
  ].join(":");
}
