import * as zarr from "zarrita";
import { Slice } from "@zarrita/indexing";

import { Region } from "../region";
import {
  Chunk,
  SourceDimension,
  SourceDimensionLod,
  SourceDimensionMap,
  isChunkData,
  LoaderAttributes,
  SliceCoordinates,
} from "../chunk";
import { isTextureUnpackRowAlignment } from "../../objects/textures/texture";
import { PromiseScheduler } from "../promise_scheduler";

import { Image as OmeZarrImage } from "./0.5/image";

import { Readable } from "@zarrita/storage";

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
};

// Loads chunks from a multiscale image implementing OME-Zarr v0.5:
// https://ngff.openmicroscopy.org/0.5/#image-layout
export class OmeZarrImageLoader {
  private readonly metadata_: OmeZarrImage["ome"]["multiscales"][number];
  private readonly arrays_: ReadonlyArray<zarr.Array<zarr.DataType, Readable>>;
  private readonly loaderAttributes_: ReadonlyArray<LoaderAttributes>;
  private readonly dimensions_: SourceDimensionMap;

  constructor(props: OmeZarrImageLoaderProps) {
    this.metadata_ = props.metadata;
    this.arrays_ = props.arrays;
    this.loaderAttributes_ = getLoaderAttributes(this.metadata_, this.arrays_);
    this.dimensions_ = inferSourceDimensionMap(this.loaderAttributes_);
  }

  public getSourceDimensionMap(): SourceDimensionMap {
    return this.dimensions_;
  }

  public async loadChunkData(chunk: Chunk, sliceCoords: SliceCoordinates) {
    const chunkCoords: number[] = [];
    chunkCoords[this.dimensions_.x.index] = chunk.chunkIndex.x;
    chunkCoords[this.dimensions_.y.index] = chunk.chunkIndex.y;
    if (this.dimensions_.z) {
      chunkCoords[this.dimensions_.z.index] = chunk.chunkIndex.z;
    }
    if (this.dimensions_.c) {
      if (sliceCoords.c === undefined) {
        throw new Error(
          "Region is missing c value but c dimension exists in data"
        );
      }
      chunkCoords[this.dimensions_.c.index] = sliceChunkIndex(
        sliceCoords.c,
        this.dimensions_.c.lods[chunk.lod]
      );
    }
    if (this.dimensions_.t) {
      if (sliceCoords.t === undefined) {
        throw new Error(
          "Region is missing t value but t dimension exists in data"
        );
      }
      chunkCoords[this.dimensions_.t.index] = sliceChunkIndex(
        sliceCoords.t,
        this.dimensions_.t.lods[chunk.lod]
      );
    }

    const array = this.arrays_[chunk.lod];
    const subarray = await array.getChunk(chunkCoords);

    const data = subarray.data;
    if (!isChunkData(data)) {
      throw new Error(
        `Subarray has an unsupported data type, data=${data.constructor.name}`
      );
    }

    const rowAlignment = data.BYTES_PER_ELEMENT;
    if (!isTextureUnpackRowAlignment(rowAlignment)) {
      throw new Error(
        "Invalid row alignment value. Possible values are 1, 2, 4, or 8"
      );
    }

    chunk.rowAlignmentBytes = rowAlignment;
    chunk.rowStride = subarray.stride[this.dimensions_.y.index];
    chunk.data = data;
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
      data: subarray.data,
      shape: {
        x: subarray.shape[subarray.shape.length - 1],
        y: subarray.shape[subarray.shape.length - 2],
        z: 1,
        c: subarray.shape.length === 3 ? subarray.shape[0] : 1,
      },
      chunkIndex: { x: 0, y: 0, z: 0 },
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

function sliceChunkIndex(value: number, lod: SourceDimensionLod): number {
  const dataIndex = Math.round((value - lod.translation) / lod.scale);
  return Math.floor(dataIndex / lod.chunkSize);
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
