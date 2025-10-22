import { Chunk, ChunkSource, SliceCoordinates } from "@/data/chunk";
import { Layer, LayerOptions } from "../core/layer";
import { VolumeRenderable } from "../objects/renderable/volume_renderable";
import { IdetikContext } from "@/idetik";
import { ChunkManagerSource } from "@/core/chunk_manager_source";
import { ImageSourcePolicy } from "@/core/image_source_policy";
import { Logger } from "@/utilities/logger";
import { Texture2D } from "@/objects/textures/texture_2d";

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

  // TODO (SKM): temp cache
  public chunks: Chunk[] = [];

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

  public update() {
    if (this.chunkManagerSource_ && this.state === "initialized") {
      const chunks = this.chunkManagerSource_.getAllChunksAtLowestRes();
      Logger.debug("VolumeLayer", `Working with ${chunks.length} chunks`);
      this.chunks = chunks;
      this.setState("loading");
    }
    if (this.state !== "loading") return;
    // TODO (SKM): haven't really hooked into the pipeline properly, so knowing
    // if the chunks are ready yet isn't really there. For now, just check
    // if it has data
    let allReady = true;
    for (const chunk of this.chunks) {
      if (!chunk.data) {
        allReady = false;
        break;
      }
    }
    if (allReady && this.state === "loading") {
      // Bind chunks to renderable
      for (const chunk of this.chunks) {
        // TODO (SKM) use the 3d texture, but needs changes in the webgl renderer
        // const texture = new Texture3D(
        //   chunk.data!,
        //   chunk.shape.x,
        //   chunk.shape.y,
        //   chunk.shape.z
        // );
        const texture = Texture2D.createWithChunk(chunk);
        const renderable = new VolumeRenderable(texture);
        renderable.wireframeEnabled = true;
        this.addObject(renderable);
      }
      this.setState("ready");
    }
    // No actual update for now, just loading the chunks really
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
}
