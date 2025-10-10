import * as zarr from "zarrita";
import { Slice } from "@zarrita/indexing";

import { Region } from "../region";
import {
  Chunk,
  SourceDimension,
  SourceDimensionMap,
  isChunkData,
  LoaderAttributes,
  ChunkData,
  ChunkDataConstructor,
} from "../chunk";
import { isTextureUnpackRowAlignment } from "../../objects/textures/texture";
import { PromiseScheduler } from "../promise_scheduler";

import { Image as OmeZarrImage } from "./0.5/image";

import { Readable } from "@zarrita/storage";
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
  arrays: zarr.Array<zarr.DataType, Readable>[];
  arrayParams: ZarrArrayParams[];
};

// Loads chunks from a multiscale image implementing OME-Zarr v0.5:
// https://ngff.openmicroscopy.org/0.5/#image-layout
export class OmeZarrImageLoader {
  private readonly metadata_: OmeZarrImage["ome"]["multiscales"][number];
  private readonly arrays_: ReadonlyArray<zarr.Array<zarr.DataType, Readable>>;
  private readonly arrayParams_: ReadonlyArray<ZarrArrayParams>;
  private readonly loaderAttributes_: ReadonlyArray<LoaderAttributes>;
  private readonly dimensions_: SourceDimensionMap;

  constructor(props: OmeZarrImageLoaderProps) {
    this.metadata_ = props.metadata;
    this.arrays_ = props.arrays;
    this.arrayParams_ = props.arrayParams;
    this.loaderAttributes_ = getLoaderAttributes(this.metadata_, this.arrays_);
    this.dimensions_ = inferSourceDimensionMap(this.loaderAttributes_);
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
    if (this.dimensions_.c) {
      chunkCoords[this.dimensions_.c.index] = chunk.chunkIndex.c;
    }
    if (this.dimensions_.t) {
      chunkCoords[this.dimensions_.t.index] = chunk.chunkIndex.t;
    }

    const array = this.arrays_[chunk.lod];
    const arrayParams = this.arrayParams_[chunk.lod];
    const receivedChunk = await getChunk(array, arrayParams, chunkCoords, {
      signal,
    });

    if (!isChunkData(receivedChunk.data)) {
      throw new Error(
        `Received chunk has an unsupported data type, data=${receivedChunk.data.constructor.name}`
      );
    }

    const receivedShape = {
      x: receivedChunk.shape[this.dimensions_.x.index],
      y: receivedChunk.shape[this.dimensions_.y.index],
      z: this.dimensions_.z
        ? receivedChunk.shape[this.dimensions_.z.index]
        : chunk.shape.z,
    };

    const receivedChunkTooSmall =
      receivedShape.x < chunk.shape.x ||
      receivedShape.y < chunk.shape.y ||
      receivedShape.z < chunk.shape.z;

    if (receivedChunkTooSmall) {
      throw new Error(
        `Received incompatible shape for chunkIndex ${JSON.stringify(chunk.chunkIndex)} at LOD ${chunk.lod}: ` +
          `expected shape: ${JSON.stringify(chunk.shape)}, received shape: ${JSON.stringify(receivedShape)} (too small)`
      );
    }

    const receivedChunkHasPadding =
      receivedShape.x > chunk.shape.x ||
      receivedShape.y > chunk.shape.y ||
      receivedShape.z > chunk.shape.z;

    if (receivedChunkHasPadding) {
      chunk.data = this.trimChunkPadding(
        chunk,
        receivedChunk.data,
        receivedChunk.stride
      );
    } else {
      chunk.data = receivedChunk.data;
      chunk.rowStride = receivedChunk.stride[this.dimensions_.y.index];
    }

    const rowAlignment = chunk.data.BYTES_PER_ELEMENT;
    if (!isTextureUnpackRowAlignment(rowAlignment)) {
      throw new Error(
        "Invalid row alignment value. Possible values are 1, 2, 4, or 8"
      );
    }
    chunk.rowAlignmentBytes = rowAlignment;
  }

  private trimChunkPadding(
    chunk: Chunk,
    receivedChunkData: ChunkData,
    receivedChunkStride: number[]
  ): ChunkData {
    const compactSize = chunk.shape.x * chunk.shape.y * chunk.shape.z;
    const compactData =
      new (receivedChunkData.constructor as ChunkDataConstructor)(compactSize);

    let offset = 0;
    const zStride = this.dimensions_.z
      ? receivedChunkStride[this.dimensions_.z.index]
      : 0;
    const yStride = receivedChunkStride[this.dimensions_.y.index];
    for (let z = 0; z < chunk.shape.z; z++) {
      const zStart = z * zStride;
      for (let y = 0; y < chunk.shape.y; y++) {
        const srcStart = zStart + y * yStride;
        const srcEnd = srcStart + chunk.shape.x;
        compactData.set(receivedChunkData.subarray(srcStart, srcEnd), offset);
        offset += chunk.shape.x;
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

    const attributes = this.loaderAttributes_[lod];
    const indices = this.regionToIndices(region, attributes);
    const { scale, translation } = attributes;
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

    const calculateOffset = (i: number) => {
      const index = indices[i];
      if (typeof index === "number") {
        return index * scale[i] + translation[i];
      } else if (index.start === null) {
        return translation[i];
      }
      return index.start * scale[i] + translation[i];
    };

    const xOffset = calculateOffset(indices.length - 1);
    const yOffset = calculateOffset(indices.length - 2);

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
      rowStride: subarray.stride[subarray.stride.length - 2],
      rowAlignmentBytes: rowAlignment,
      scale: {
        x: scale[indices.length - 1],
        y: scale[indices.length - 2],
        z: 1,
      },
      offset: { x: xOffset, y: yOffset, z: 0 },
    };
    return chunk;
  }

  public getAttributes(): ReadonlyArray<LoaderAttributes> {
    return this.loaderAttributes_;
  }

  private regionToIndices(
    region: Region,
    attributes: LoaderAttributes
  ): Array<Slice | number> {
    const { dimensionNames, scale, translation } = attributes;

    const indices: Array<Slice | number> = [];
    for (const [i, dimName] of dimensionNames.entries()) {
      const match = region.find((s) => s.dimension == dimName);
      if (!match) {
        throw new Error(`Region does not contain a slice for ${dimName}`);
      }
      let index: Slice | number;
      const regionIndex = match.index;
      if (regionIndex.type === "full") {
        // null slice is the complete extent of a dimension like Python's `slice(None)`.
        index = zarr.slice(null);
      } else if (regionIndex.type === "point") {
        index = Math.round((regionIndex.value - translation[i]) / scale[i]);
      } else {
        index = zarr.slice(
          Math.floor((regionIndex.start - translation[i]) / scale[i]),
          Math.ceil((regionIndex.stop - translation[i]) / scale[i])
        );
      }
      indices.push(index);
    }
    return indices;
  }
}

function getLoaderAttributes(
  image: OmeZarrImage["ome"]["multiscales"][number],
  arrays: ReadonlyArray<zarr.Array<zarr.DataType, Readable>>
): LoaderAttributes[] {
  const output: LoaderAttributes[] = [];
  const numAxes = image.axes.length;
  for (let i = 0; i < image.datasets.length; i++) {
    const dataset = image.datasets[i];
    const array = arrays[i];
    const scale = dataset.coordinateTransformations[0].scale;
    const translation =
      dataset.coordinateTransformations.length === 2
        ? dataset.coordinateTransformations[1].translation
        : new Array(numAxes).fill(0);
    output.push({
      dimensionNames: image.axes.map((axis) => axis.name),
      dimensionUnits: image.axes.map((axis) => axis.unit),
      chunks: array.chunks,
      shape: array.shape,
      scale,
      translation,
    });
  }
  return output;
}

function inferSourceDimensionMap(
  attrs: ReadonlyArray<LoaderAttributes>
): SourceDimensionMap {
  const names = attrs[0].dimensionNames;

  const xIndex = findDimensionIndex(names, "x");
  const yIndex = findDimensionIndex(names, "y");
  const dims: SourceDimensionMap = {
    x: getSourceDimension(names[xIndex], xIndex, attrs),
    y: getSourceDimension(names[yIndex], yIndex, attrs),
    numLods: attrs.length,
  };

  const zIndex = findDimensionIndexSafe(names, "z");
  if (zIndex !== -1) {
    dims.z = getSourceDimension(names[zIndex], zIndex, attrs);
  }

  const cIndex = findDimensionIndexSafe(names, "c");
  if (cIndex !== -1) {
    dims.c = getSourceDimension(names[cIndex], cIndex, attrs);
  }

  const tIndex = findDimensionIndexSafe(names, "t");
  if (tIndex !== -1) {
    dims.t = getSourceDimension(names[tIndex], tIndex, attrs);
  }

  return dims;
}

function getSourceDimension(
  name: string,
  index: number,
  attrs: ReadonlyArray<LoaderAttributes>
): SourceDimension {
  return {
    name,
    index,
    lods: attrs.map((attr) => ({
      size: attr.shape[index],
      chunkSize: attr.chunks[index],
      scale: attr.scale[index],
      translation: attr.translation[index],
    })),
  };
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
