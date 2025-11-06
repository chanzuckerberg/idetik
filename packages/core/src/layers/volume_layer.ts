import { Chunk, ChunkSource, SliceCoordinates } from "../data/chunk";
import { Layer, LayerOptions } from "../core/layer";
import { VolumeRenderable } from "../objects/renderable/volume_renderable";
import { IdetikContext } from "../idetik";
import { ChunkManagerSource } from "../core/chunk_manager_source";
import { ImageSourcePolicy } from "../core/image_source_policy";
import { Texture3D } from "../objects/textures/texture_3d";

export type VolumeLayerProps = LayerOptions & {
  source: ChunkSource;
  sliceCoords: SliceCoordinates;
  policy: ImageSourcePolicy;
};

export class VolumeLayer extends Layer {
  public readonly type = "VolumeLayer";
  private source_: ChunkSource;
  private sliceCoords_: SliceCoordinates;
  private policy_: ImageSourcePolicy;
  private chunkManagerSource_?: ChunkManagerSource;
  private debugMode_ = false;

  // TODO (SKM): temp simple array cache to focus on 3D texture
  // in the future, would likely work similarly to the visible
  // chunks map in ChunkedImageLayer
  private chunks_: Chunk[] = [];

  public get chunks() {
    return this.chunks_;
  }

  public set chunks(value: Chunk[]) {
    this.chunks_ = value;
  }

  public get debugMode(): boolean {
    return this.debugMode_;
  }

  public set debugMode(debug: boolean) {
    this.debugMode_ = debug;
  }

  // TODO make private as in chunked_image_layer
  public createVolume(chunk: Chunk) {
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

  public update() {
    if (this.chunkManagerSource_ && this.state === "initialized") {
      const chunks = this.chunkManagerSource_.getAllChunksAtRes(0);
      this.chunks = chunks;
      this.setState("loading");
    }
    if (this.state !== "loading") return;
    // TODO (SKM): haven't really hooked into chunk manager fully yet, so
    // we just quit out if any chunk is not ready
    let allReady = true;
    for (const chunk of this.chunks) {
      if (!chunk.data) {
        allReady = false;
        break;
      }
    }
    if (allReady && this.state === "loading") {
      // Bind chunks to renderable - we only do it once for now
      for (let i = 0; i < this.chunks.length; i++) {
        const chunk = this.chunks[i];
        const renderable = this.createVolume(chunk);
        renderable.wireframeEnabled = true;
        this.addObject(renderable);
      }
      this.setState("ready");
    }
  }
}
