import { Chunk, ChunkSource, SliceCoordinates } from "../data/chunk";
import { Layer, RenderContext } from "../core/layer";
import { VolumeRenderable } from "../objects/renderable/volume_renderable";
import { IdetikContext } from "../idetik";
import { ChunkStoreView, INTERNAL_POLICY_KEY } from "../core/chunk_store_view";
import { ImageSourcePolicy } from "../core/image_source_policy";
import { Texture3D } from "../objects/textures/texture_3d";
import { RenderablePool } from "../utilities/renderable_pool";
import { glMatrix, vec3 } from "gl-matrix";
import { Camera } from "../objects/cameras/camera";

export type VolumeLayerProps = {
  source: ChunkSource;
  sliceCoords: SliceCoordinates;
  policy: ImageSourcePolicy;
};

export class VolumeLayer extends Layer {
  public readonly type = "VolumeLayer";

  private readonly source_: ChunkSource;
  private readonly sliceCoords_: SliceCoordinates;
  private readonly currentChunks_: Map<Chunk, VolumeRenderable> = new Map();
  private readonly pool_ = new RenderablePool<VolumeRenderable>();

  private sourcePolicy_: ImageSourcePolicy;
  private chunkStoreView_?: ChunkStoreView;

  private lastLoadedTime_: number | undefined = undefined;
  // TODO: Make a debug config object to manage debug options
  private debugShowWireframes_ = false;
  public debugShowDegenerateRays = false;
  public color = vec3.fromValues(1.0, 1.0, 1.0);
  public samplesPerUnit = 128.0;
  public maxIntensity = 255.0;
  public opacityMultiplier = 0.1;
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
    const volume = new VolumeRenderable(Texture3D.createWithChunk(chunk));
    this.updateVolumeChunk(volume, chunk);
    return volume;
  }

  constructor({ source, sliceCoords, policy }: VolumeLayerProps) {
    super({ transparent: true, blendMode: "premultiplied" });
    this.source_ = source;
    this.sliceCoords_ = sliceCoords;
    this.sourcePolicy_ = policy;
    this.setState("initialized");
  }

  private getVolumeForChunk(chunk: Chunk): VolumeRenderable {
    const existing = this.currentChunks_.get(chunk);
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
      this.addObject(volume);
    }

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
    vec3.set(volume.chunkWorldSize, worldSize.x, worldSize.y, worldSize.z);
    const originOffset = {
      x: worldSize.x / 2,
      y: worldSize.y / 2,
      z: worldSize.z / 2,
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
    `align${chunk.rowAlignmentBytes}`,
  ].join(":");
}
