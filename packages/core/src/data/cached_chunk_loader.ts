import {
  Chunk,
  SourceDimensionMap,
  ChunkLoader,
  SliceCoordinates,
} from "./chunk";
import { Logger } from "../utilities/logger";

export class CachedChunkLoader {
  private readonly loader_: ChunkLoader;
  private readonly chunks_: Chunk[];
  private readonly dimensions_: SourceDimensionMap;

  constructor(loader: ChunkLoader) {
    this.loader_ = loader;
    this.dimensions_ = this.loader_.getSourceDimensionMap();

    // generate chunks for each LOD without loading data
    this.chunks_ = [];
    for (let lod = 0; lod < this.dimensions_.numLods; ++lod) {
      const xLod = this.dimensions_.x.lods[lod];
      const yLod = this.dimensions_.y.lods[lod];
      const zLod = this.dimensions_.z?.lods[lod];
      const cLod = this.dimensions_.c?.lods[lod];

      const chunkWidth = xLod.chunkSize;
      const chunkHeight = yLod.chunkSize;
      const chunkDepth = zLod?.chunkSize ?? 1;

      const chunksX = Math.ceil(xLod.size / chunkWidth);
      const chunksY = Math.ceil(yLod.size / chunkHeight);
      const chunksZ = Math.ceil((zLod?.size ?? 1) / chunkDepth);
      const channels = cLod?.size ?? 1;

      for (let x = 0; x < chunksX; ++x) {
        const xOffset = xLod.translation + x * xLod.chunkSize * xLod.scale;
        for (let y = 0; y < chunksY; ++y) {
          const yOffset = yLod.translation + y * yLod.chunkSize * yLod.scale;
          for (let z = 0; z < chunksZ; ++z) {
            const zOffset =
              zLod !== undefined
                ? zLod.translation + z * chunkDepth * zLod.scale
                : 0;
            this.chunks_.push({
              state: "unloaded",
              lod,
              visible: false,
              prefetch: false,
              shape: {
                x: chunkWidth,
                y: chunkHeight,
                z: chunkDepth,
                c: channels,
              },
              rowStride: chunkWidth,
              rowAlignmentBytes: 1,
              chunkIndex: { x, y, z },
              scale: {
                x: xLod.scale,
                y: yLod.scale,
                z: zLod?.scale ?? 1,
              },
              offset: {
                x: xOffset,
                y: yOffset,
                z: zOffset,
              },
            });
          }
        }
      }
    }
  }

  public get dimensions() {
    return this.dimensions_;
  }

  public get chunks(): Chunk[] {
    return this.chunks_;
  }

  public loadChunkData(chunk: Chunk, sliceCoords: SliceCoordinates): void {
    chunk.state = "loading";
    this.loader_
      .loadChunkData(chunk, sliceCoords)
      .then(() => {
        chunk.state = "loaded";
      })
      .catch((error) => {
        Logger.error(
          "ChunkManager",
          `Error loading chunk (${chunk.chunkIndex.x},${chunk.chunkIndex.y},${chunk.chunkIndex.z}): ${error}`
        );
        chunk.state = "unloaded";
      });
  }
}
