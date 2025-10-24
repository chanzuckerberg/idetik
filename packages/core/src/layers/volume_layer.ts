import { Chunk, ChunkSource, SliceCoordinates } from "@/data/chunk";
import { Layer, LayerOptions } from "../core/layer";
import { VolumeRenderable } from "../objects/renderable/volume_renderable";
import { IdetikContext } from "@/idetik";
import { ChunkManagerSource } from "@/core/chunk_manager_source";
import { ImageSourcePolicy } from "@/core/image_source_policy";
import { Texture3D } from "@/objects/textures/texture_3d";
import { vec3 } from "gl-matrix";

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
      const chunks = this.chunkManagerSource_.getAllChunksAtLowestRes();
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
      let max_x = 0;
      let max_y = 0;
      for (let i = 0; i < this.chunks.length; i++) {
        const chunk = this.chunks[i];
        const texture = new Texture3D(
          chunk.data!,
          chunk.shape.x,
          chunk.shape.y,
          chunk.shape.z
        );
        // Divide by 100 to scale down for visualization purposes
        const renderable = new VolumeRenderable(
          chunk.shape.x / 100,
          chunk.shape.y / 100,
          chunk.shape.z / 100,
          texture
        );
        // TODO (SKM): positioning needs to be fixed properly using chunk info
        max_x = Math.max(max_x, chunk.shape.x / 100);
        max_y = Math.max(max_y, chunk.shape.y / 100);
        renderable.transform.setTranslation(
          vec3.fromValues(
            Math.floor(i / 2) * (max_x / 2 + chunk.shape.x / 200),
            (i % 2) * (max_y / 2 + chunk.shape.y / 200),
            0
          )
        );
        renderable.wireframeEnabled = true;
        this.addObject(renderable);
      }
      this.setState("ready");
    }
  }
}
