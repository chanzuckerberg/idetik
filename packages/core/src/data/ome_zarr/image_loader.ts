import * as zarr from "zarrita";

import { Region } from "../region";
import {
  Chunk,
  SourceDimension,
  SourceDimensionMap,
  isChunkData,
  ChunkData,
  ChunkDataConstructor,
  SourceDimensionLod,
} from "../chunk";
import { isTextureUnpackRowAlignment } from "../../objects/textures/texture";
import { PromiseScheduler } from "../promise_scheduler";

import { Image as OmeZarrImage } from "./0.5/image";

import { ZarrArrayParams } from "../zarr/open";
import { getChunk } from "./worker_pool";

// Implements the interface required for getting array chunks in zarrita:
// https://github.com/manzt/zarrita.js/blob/c15c1a14e42a83516972368ac962ebdf56a6dcdb/packages/indexing/src/types.ts#L52
export class PromiseQueue<T> {
  private readonly promises_: Array<() => Promise<T>> = [];
  private readonly scheduler_: PromiseScheduler;

  constructor(scheduler: PromiseScheduler) {
    this.scheduler_ = scheduler;
  }

  add(promise: () => Promise<T>) {
    this.promises_.push(promise);
  }

  onIdle(): Promise<Array<T>> {
    return Promise.all(this.promises_.map((p) => this.scheduler_.submit(p)));
  }
}

type OmeZarrImageLoaderProps = {
  metadata: OmeZarrImage["ome"]["multiscales"][number];
  arrays: zarr.Array<zarr.DataType, zarr.Readable>[];
  arrayParams: ZarrArrayParams[];
};

// Loads chunks from a multiscale image implementing OME-Zarr v0.5:
// https://ngff.openmicroscopy.org/0.5/#image-layout
export class OmeZarrImageLoader {
  private readonly metadata_: OmeZarrImage["ome"]["multiscales"][number];
  private readonly arrays_: ReadonlyArray<
    zarr.Array<zarr.DataType, zarr.Readable>
  >;
  private readonly arrayParams_: ReadonlyArray<ZarrArrayParams>;
  private readonly dimensions_: SourceDimensionMap;

  constructor(props: OmeZarrImageLoaderProps) {
    this.metadata_ = props.metadata;
    this.arrays_ = props.arrays;
    this.arrayParams_ = props.arrayParams;
    this.dimensions_ = inferSourceDimensionMap(this.metadata_, this.arrays_);
  }

  public getSourceDimensionMap(): SourceDimensionMap {
    return this.dimensions_;
  }

  public async loadChunkData(chunk: Chunk, signal: AbortSignal) {
    const chunkCoords: number[] = [];
    chunkCoords[this.dimensions_.x.index] = chunk.chunkIndex.x;
    chunkCoords[this.dimensions_.y.index] = chunk.chunkIndex.y;
    if (this.dimensions_.z) {
      chunkCoords[this.dimensions_.z.index] = chunk.chunkIndex.z;
    }

    // internal (ChunkStore) chunks have size 1 in C and T
    // so divide by the actual chunkSize to get the chunkCoord here
    if (this.dimensions_.c) {
      const cLod = this.dimensions_.c.lods[chunk.lod];
      chunkCoords[this.dimensions_.c.index] = Math.floor(
        chunk.chunkIndex.c / cLod.chunkSize
      );
    }
    if (this.dimensions_.t) {
      const tLod = this.dimensions_.t.lods[chunk.lod];
      chunkCoords[this.dimensions_.t.index] = Math.floor(
        chunk.chunkIndex.t / tLod.chunkSize
      );
    }

    const array = this.arrays_[chunk.lod];
    const arrayParams = this.arrayParams_[chunk.lod];

    // NOTE: if source chunks have multiple channels/timepoints
    // this results in duplicate fetching and decompression
    const receivedChunk = await getChunk(array, arrayParams, chunkCoords, {
      signal,
    });

    if (!isChunkData(receivedChunk.data)) {
      throw new Error(
        `Received chunk has an unsupported data type, data=${receivedChunk.data.constructor.name}`
      );
    }

    validateTightlyPackedChunk(receivedChunk);

    chunk.data = this.sliceSourceChunk(
      chunk,
      receivedChunk.data,
      receivedChunk.stride
    );

    const rowAlignment = chunk.data.BYTES_PER_ELEMENT;
    if (!isTextureUnpackRowAlignment(rowAlignment)) {
      throw new Error(
        "Invalid row alignment value. Possible values are 1, 2, 4, or 8"
      );
    }
    chunk.rowAlignmentBytes = rowAlignment;
  }

  // trim any padding (XYZ padding for edge chunks)
  // and extract the channel/timepoint
  private sliceSourceChunk(
    chunk: Chunk,
    sourceData: ChunkData,
    sourceStride: number[]
  ): ChunkData {
    const cLod = this.dimensions_.c?.lods[chunk.lod];
    const tLod = this.dimensions_.t?.lods[chunk.lod];

    const cOffsetInSource = cLod ? chunk.chunkIndex.c % cLod.chunkSize : 0;
    const tOffsetInSource = tLod ? chunk.chunkIndex.t % tLod.chunkSize : 0;

    // internal chunks are compact 3D XYZ, with size 1 in C and T
    const compactSize = chunk.shape.x * chunk.shape.y * chunk.shape.z;
    const compactData = new (sourceData.constructor as ChunkDataConstructor)(
      compactSize
    );

    const cStride = this.dimensions_.c
      ? sourceStride[this.dimensions_.c.index]
      : 0;
    const tStride = this.dimensions_.t
      ? sourceStride[this.dimensions_.t.index]
      : 0;
    const zStride = this.dimensions_.z
      ? sourceStride[this.dimensions_.z.index]
      : 0;
    const yStride = sourceStride[this.dimensions_.y.index];

    // note: this assumes tczyx ordering
    const baseOffset = tOffsetInSource * tStride + cOffsetInSource * cStride;
    let destOffset = 0;
    for (let z = 0; z < chunk.shape.z; z++) {
      const zStart = baseOffset + z * zStride;
      for (let y = 0; y < chunk.shape.y; y++) {
        const srcStart = zStart + y * yStride;
        const srcEnd = srcStart + chunk.shape.x;
        compactData.set(sourceData.subarray(srcStart, srcEnd), destOffset);
        destOffset += chunk.shape.x;
      }
    }

    return compactData;
  }

  public async loadRegion(
    region: Region,
    lod: number,
    scheduler?: PromiseScheduler
  ): Promise<Chunk> {
    if (lod >= this.arrays_.length) {
      throw new Error(
        `Invalid LOD index: ${lod}. Only ${this.arrays_.length} lod(s) available`
      );
    }

    const indices = this.regionToIndices(region, lod);

    const array = this.arrays_[lod];

    let options = {};
    if (scheduler !== undefined) {
      options = {
        create_queue: () => new PromiseQueue(scheduler),
        opts: { signal: scheduler.abortSignal },
      };
    }
    const subarray = await zarr.get(array, indices, options);

    if (!isChunkData(subarray.data)) {
      throw new Error(
        `Subarray has an unsupported data type, data=${subarray.data.constructor.name}`
      );
    }

    validateTightlyPackedChunk(subarray);

    if (subarray.shape.length !== 2 && subarray.shape.length !== 3) {
      throw new Error(
        `Expected to receive a 2D or 3D subarray. Instead chunk has shape ${subarray.shape}`
      );
    }

    const rowAlignment = subarray.data.BYTES_PER_ELEMENT;
    if (!isTextureUnpackRowAlignment(rowAlignment)) {
      throw new Error(
        "Invalid row alignment value. Possible values are 1, 2, 4, or 8"
      );
    }

    const calculateOffset = (
      index: number | zarr.Slice,
      lod: SourceDimensionLod
    ) => {
      if (typeof index === "number") {
        return index * lod.scale + lod.translation;
      } else if (index.start === null) {
        return lod.translation;
      }
      return index.start * lod.scale + lod.translation;
    };

    const xLod = this.dimensions_.x.lods[lod];
    const xIndex = indices[this.dimensions_.x.index];
    const xOffset = calculateOffset(xIndex, xLod);
    const yIndex = indices[this.dimensions_.y.index];
    const yLod = this.dimensions_.y.lods[lod];
    const yOffset = calculateOffset(yIndex, yLod);

    const chunk: Chunk = {
      state: "loaded",
      lod: lod,
      visible: true,
      prefetch: false,
      priority: null,
      orderKey: null,
      data: subarray.data,
      shape: {
        x: subarray.shape[subarray.shape.length - 1],
        y: subarray.shape[subarray.shape.length - 2],
        z: 1,
        c: subarray.shape.length === 3 ? subarray.shape[0] : 1,
      },
      chunkIndex: { x: 0, y: 0, z: 0, c: 0, t: 0 },
      rowAlignmentBytes: rowAlignment,
      scale: {
        x: xLod.scale,
        y: yLod.scale,
        z: 1,
      },
      offset: { x: xOffset, y: yOffset, z: 0 },
    };
    return chunk;
  }

  private regionToIndices(
    region: Region,
    lod: number
  ): Array<zarr.Slice | number> {
    const dimensions = [
      this.dimensions_.x,
      this.dimensions_.y,
      this.dimensions_.z,
      this.dimensions_.c,
      this.dimensions_.t,
    ]
      .filter((d): d is SourceDimension => d !== undefined)
      .sort((a, b) => a.index - b.index);

    const indices: Array<zarr.Slice | number> = [];
    for (const d of dimensions) {
      const match = region.find((s) => compareDimensions(s.dimension, d.name));
      if (!match) {
        throw new Error(`Region does not contain a slice for ${d.name}`);
      }
      const dLod = d.lods[lod];
      let index: zarr.Slice | number;
      const regionIndex = match.index;
      if (regionIndex.type === "full") {
        // null slice is the complete extent of a dimension like Python's `slice(None)`.
        index = zarr.slice(null);
      } else if (regionIndex.type === "point") {
        index = Math.round((regionIndex.value - dLod.translation) / dLod.scale);
      } else {
        index = zarr.slice(
          Math.floor((regionIndex.start - dLod.translation) / dLod.scale),
          Math.ceil((regionIndex.stop - dLod.translation) / dLod.scale)
        );
      }
      indices.push(index);
    }
    return indices;
  }
}

function inferSourceDimensionMap(
  image: OmeZarrImage["ome"]["multiscales"][number],
  arrays: ReadonlyArray<zarr.Array<zarr.DataType, zarr.Readable>>
): SourceDimensionMap {
  const dimensionNames = image.axes.map((axis) => axis.name);
  const numAxes = image.axes.length;

  const xIndex = findDimensionIndex(dimensionNames, "x");
  const yIndex = findDimensionIndex(dimensionNames, "y");

  const makeSourceDimension = (
    name: string,
    index: number
  ): SourceDimension => {
    const lods = [];
    for (let i = 0; i < image.datasets.length; i++) {
      const dataset = image.datasets[i];
      const array = arrays[i];
      const scale = dataset.coordinateTransformations[0].scale;
      const translation =
        dataset.coordinateTransformations.length === 2
          ? dataset.coordinateTransformations[1].translation
          : new Array(numAxes).fill(0);
      lods.push({
        size: array.shape[index],
        chunkSize: array.chunks[index],
        scale: scale[index],
        translation: translation[index],
      });
    }
    return {
      name,
      index,
      unit: image.axes[index].unit,
      lods,
    };
  };

  const dims: SourceDimensionMap = {
    x: makeSourceDimension(dimensionNames[xIndex], xIndex),
    y: makeSourceDimension(dimensionNames[yIndex], yIndex),
    numLods: arrays.length,
  };

  const zIndex = findDimensionIndexSafe(dimensionNames, "z");
  if (zIndex !== -1) {
    dims.z = makeSourceDimension(dimensionNames[zIndex], zIndex);
  }

  const cIndex = findDimensionIndexSafe(dimensionNames, "c");
  if (cIndex !== -1) {
    dims.c = makeSourceDimension(dimensionNames[cIndex], cIndex);
  }

  const tIndex = findDimensionIndexSafe(dimensionNames, "t");
  if (tIndex !== -1) {
    dims.t = makeSourceDimension(dimensionNames[tIndex], tIndex);
  }

  return dims;
}

function compareDimensions(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function findDimensionIndex(dimensions: string[], target: string): number {
  const index = findDimensionIndexSafe(dimensions, target);
  if (index === -1) {
    throw new Error(
      `Could not find "${target}" dimension in [${dimensions.join(", ")}]`
    );
  }
  return index;
}

function findDimensionIndexSafe(dimensions: string[], target: string): number {
  return dimensions.findIndex((d) => compareDimensions(d, target));
}

function validateTightlyPackedChunk(chunk: zarr.Chunk<zarr.DataType>): void {
  let stride = 1;
  for (let i = chunk.shape.length - 1; i >= 0; i--) {
    if (chunk.stride[i] !== stride) {
      throw new Error(
        `Chunk data is not tightly packed, stride=${JSON.stringify(chunk.stride)}, shape=${JSON.stringify(chunk.shape)}`
      );
    }
    stride *= chunk.shape[i];
  }
}
