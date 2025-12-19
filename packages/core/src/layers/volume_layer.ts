import { Chunk, ChunkSource, SliceCoordinates } from "../data/chunk";
import { Layer, RenderContext } from "../core/layer";
import { VolumeRenderable } from "../objects/renderable/volume_renderable";
import { IdetikContext } from "../idetik";
import { ChunkStoreView, INTERNAL_POLICY_KEY } from "../core/chunk_store_view";
import { ImageSourcePolicy } from "../core/image_source_policy";
import { Texture3D } from "../objects/textures/texture_3d";
import { RenderablePool } from "../utilities/renderable_pool";
import { glMatrix, vec3 } from "gl-matrix";
import { Camera } from "@/objects/cameras/camera";

export type VolumeLayerProps = {
  source: ChunkSource;
  sliceCoords: SliceCoordinates;
  policy: ImageSourcePolicy;
  lod?: number;
};

export type OrderingMode = "front-to-back" | "back-to-front";

export class VolumeLayer extends Layer {
  public readonly type = "VolumeLayer";

  private readonly source_: ChunkSource;
  private readonly sliceCoords_: SliceCoordinates;
  private readonly visibleChunks_: Map<Chunk, VolumeRenderable> = new Map();
  private readonly pool_ = new RenderablePool<VolumeRenderable>();

  private sourcePolicy_: ImageSourcePolicy;
  private chunkStoreView_?: ChunkStoreView;
  private lod_ = 0;
  public debugMode = false;

  private lastLoadedLod_ = -1;
  private lastLoadedTime_ = -1;
  public enableRayCorrection = false;
  private color_ = vec3.fromValues(1.0, 1.0, 1.0);
  public sampleDensity = 128.0; // Samples per unit texture space
  public maxIntensity = 255.0; // Normalization factor for intensity
  public opacityScale = 0.1; // Alpha multiplier
  public alphaThreshold = 0.99; // Early ray termination threshold

  public get lod() {
    return this.lod_;
  }

  public set lod(value: number) {
    this.lod_ = value;
    this.clearObjects();
    this.updateChunks();
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
    const volume = new VolumeRenderable(Texture3D.createWithChunk(chunk));
    this.updateVolumeChunk(volume, chunk);
    return volume;
  }

  constructor({ source, sliceCoords, policy, lod = 0 }: VolumeLayerProps) {
    // Volume rendering is always transparent with fixed blend mode
    super({ transparent: true, blendMode: "premultiplied" });
    this.source_ = source;
    this.sliceCoords_ = sliceCoords;
    this.sourcePolicy_ = policy;
    this.lod_ = lod;
    this.setState("initialized");
  }

  private getVolumeForChunk(chunk: Chunk): VolumeRenderable {
    const existing = this.visibleChunks_.get(chunk);
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
      const volume = this.getVolumeForChunk(chunk);
      volume.wireframeEnabled = this.debugMode;
      this.visibleChunks_.set(chunk, volume);
      this.addObject(volume);
    }

    this.lastLoadedLod_ = this.lod_;
    this.lastLoadedTime_ = currentTime;

    if (this.state !== "ready") this.setState("ready");
  }

  private updateVolumeChunk(volume: VolumeRenderable, chunk: Chunk) {
    volume.transform.setScale([
      chunk.shape.x * chunk.scale.x,
      chunk.shape.y * chunk.scale.y,
      chunk.shape.z * chunk.scale.z,
    ]);
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
      EnableRayCorrection: Number(this.enableRayCorrection),
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
    `align${chunk.rowAlignmentBytes}`,
  ].join(":");
}
