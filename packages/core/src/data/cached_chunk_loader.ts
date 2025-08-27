import {
  Chunk,
  ChunkDimensionMap,
  ChunkLoader,
  SliceCoordinates,
} from "./chunk";
import { almostEqual } from "../utilities/almost_equal";
import { Logger } from "../utilities/logger";

export class CachedChunkLoader {
  private readonly loader_: ChunkLoader;
  private readonly chunks_: Chunk[];
  private readonly dimensions_: ChunkDimensionMap;

  constructor(loader: ChunkLoader) {
    this.loader_ = loader;
    this.dimensions_ = this.loader_.getDimensionMap();
    this.validateXYScaleRatios();

    // generate chunks for each LOD without loading data
    this.chunks_ = [];
    for (let lod = 0; lod < this.dimensions_.numLods; ++lod) {
      const xDim = this.dimensions_.x.lods[lod];
      const yDim = this.dimensions_.y.lods[lod];
      const zDim = this.dimensions_.z?.lods[lod];
      const cDim = this.dimensions_.c?.lods[lod];

      const chunkWidth = xDim.chunkSize;
      const chunkHeight = yDim.chunkSize;
      const chunkDepth = zDim?.chunkSize ?? 1;

      const chunksX = Math.ceil(xDim.size / chunkWidth);
      const chunksY = Math.ceil(yDim.size / chunkHeight);
      const chunksZ = Math.ceil((zDim?.size ?? 1) / chunkDepth);
      const channels = cDim?.size ?? 1;

      for (let x = 0; x < chunksX; ++x) {
        const xOffset = xDim.translation + x * xDim.chunkSize * xDim.scale;
        for (let y = 0; y < chunksY; ++y) {
          const yOffset = yDim.translation + y * yDim.chunkSize * yDim.scale;
          for (let z = 0; z < chunksZ; ++z) {
            const zOffset =
              zDim !== undefined
                ? zDim.translation + z * chunkDepth * zDim.scale
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
                x: xDim.scale,
                y: yDim.scale,
                z: zDim?.scale ?? 1,
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

  private validateXYScaleRatios(): void {
    // Validates that each LOD level is downsampled by a factor of 2 in X and Y.
    // Z downsampling is not validated here because it may be inconsistent or
    // completely absent in some pyramids.
    const xDim = this.dimensions_.x;
    const yDim = this.dimensions_.y;
    for (let i = 1; i < this.dimensions_.numLods; i++) {
      const rx = xDim.lods[i].scale / xDim.lods[i - 1].scale;
      const ry = xDim.lods[i].scale / yDim.lods[i - 1].scale;

      if (!almostEqual(rx, 2) || !almostEqual(ry, 2)) {
        throw new Error(
          `Invalid downsampling factor between levels ${i - 1} → ${i}: ` +
            `expected (2× in X and Y), but got ` +
            `(${rx.toFixed(2)}×, ${ry.toFixed(2)}×) from scale ` +
            `[${xDim.lods[i - 1].scale}, ${yDim.lods[i - 1].scale}] → [${xDim.lods[i].scale}, ${yDim.lods[i].scale}]`
        );
      }
    }
  }
}
