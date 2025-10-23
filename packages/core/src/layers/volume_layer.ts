import { Chunk, ChunkSource, SliceCoordinates } from "@/data/chunk";
import { Layer, LayerOptions } from "../core/layer";
import { VolumeRenderable } from "../objects/renderable/volume_renderable";
import { IdetikContext } from "@/idetik";
import { ChunkManagerSource } from "@/core/chunk_manager_source";
import { ImageSourcePolicy } from "@/core/image_source_policy";
import { Logger } from "@/utilities/logger";
// import { Texture2D } from "@/objects/textures/texture_2d";
// import { clamp } from "@/utilities/clamp";
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

  // TODO (SKM): temp cache
  public chunks: Chunk[] = [];

  // TODO (SKM): very temp change for uniforms
  public zUV: number = 0;
  public tickCount: number = 0;

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
      for (let i = 0; i < this.chunks.length; i++) {
        const chunk = this.chunks[i];
        // TODO (SKM) use the 3d texture, but needs changes in the webgl renderer
        const texture = new Texture3D(
          chunk.data!,
          chunk.shape.x,
          chunk.shape.y,
          chunk.shape.z
        );
        // const data =
        //   this.sliceCoords_?.z !== undefined
        //     ? this.slicePlane(chunk, this.sliceCoords_.z)
        //     : chunk.data;
        // const texture = Texture2D.createWithChunk(chunk, data);
        const renderable = new VolumeRenderable(texture);
        renderable.transform.setTranslation(vec3.fromValues(i, 0, 0));
        renderable.wireframeEnabled = true;
        this.addObject(renderable);
      }
      this.setState("ready");
    }
    // this.tickCount++;
    // if (this.tickCount > 100000) this.tickCount = 0;
    // if (this.tickCount % 30 === 0) {
    //   this.zUV += 0.001;
    //   this.zUV = clamp(this.zUV, 0, 1);
    // for (const object of this.objects) {
    //   object.uniforms = {
    //     u_zSlice: this.zUV,
    //   };
    // }
    // }
    // No actual update for now, just loading the chunks really
  }

  // private slicePlane(chunk: Chunk, zValue: number) {
  //   if (!chunk.data) return;
  //   const zLocal = (zValue - chunk.offset.z) / chunk.scale.z;
  //   const zIdx = Math.round(zLocal);
  //   const zClamped = clamp(zIdx, 0, chunk.shape.z - 1);

  //   // Treat values within ~1 voxel (plus tiny floating-point error) as OK.
  //   // Anything further away means the requested zValue is outside.
  //   if (!almostEqual(zLocal, zClamped, 1 + 1e-6)) {
  //     Logger.error("ImageLayer", "slicePlane zValue outside extent");
  //   }

  //   const sliceSize = chunk.shape.x * chunk.shape.y;
  //   const offset = sliceSize * zClamped;
  //   return chunk.data.slice(offset, offset + sliceSize);
  // }

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
