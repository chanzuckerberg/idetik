import * as zarr from "zarrita";
import { Slice } from "@zarrita/indexing";

import { Region } from "../region";
import {
  Chunk,
  DimensionMap,
  isChunkData,
  LoaderAttributes,
  SliceDimension,
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
  private readonly lods_: number;
  private readonly loaderAttributes_: ReadonlyArray<LoaderAttributes>;

  constructor(props: OmeZarrImageLoaderProps) {
    this.metadata_ = props.metadata;
    this.arrays_ = props.arrays;
    this.loaderAttributes_ = getLoaderAttributes(this.metadata_, this.arrays_);
    this.lods_ = this.metadata_.datasets.length;
  }

  public getDimensionMap(region: Region): DimensionMap {
    const names = this.loaderAttributes_[0].dimensionNames;
    const xIndex = findDimensionIndex(names, "x");
    const yIndex = findDimensionIndex(names, "y");
    const zIndex = findDimensionIndexSafe(names, "z");
    const cIndex = findDimensionIndexSafe(names, "c");
    const tIndex = findDimensionIndexSafe(names, "t");

    const mapping: DimensionMap = {
      x: { name: names[xIndex], sourceIndex: xIndex },
      y: { name: names[yIndex], sourceIndex: yIndex },
    };

    if (zIndex !== -1) {
      const value = findRegionPointValue(region, "z");
      mapping.z = {
        name: names[zIndex],
        sourceIndex: zIndex,
        pointWorld: value,
      };
    }

    if (cIndex !== -1) {
      const value = findRegionPointValue(region, "c");
      mapping.c = {
        name: names[cIndex],
        sourceIndex: cIndex,
        pointWorld: value,
      };
    }

    if (tIndex !== -1) {
      const value = findRegionPointValue(region, "t");
      mapping.t = {
        name: names[tIndex],
        sourceIndex: tIndex,
        pointWorld: value,
      };
    }

    return mapping;
  }

  public async loadChunkData(chunk: Chunk, mapping: DimensionMap) {
    const array = this.arrays_[chunk.lod];
    const attrs = this.loaderAttributes_[chunk.lod];

    const chunkCoords: number[] = [];
    chunkCoords[mapping.x.sourceIndex] = chunk.chunkIndex.x;
    chunkCoords[mapping.y.sourceIndex] = chunk.chunkIndex.y;
    if (mapping.z) {
      chunkCoords[mapping.z.sourceIndex] = chunk.chunkIndex.z;
    }
    if (mapping.c) {
      chunkCoords[mapping.c.sourceIndex] = sliceChunkIndex(mapping.c, attrs);
    }
    if (mapping.t) {
      chunkCoords[mapping.t.sourceIndex] = sliceChunkIndex(mapping.t, attrs);
    }

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
    chunk.rowStride = subarray.stride[mapping.y.sourceIndex];
    chunk.data = data;
  }

  public async loadRegion(
    region: Region,
    lod: number,
    scheduler?: PromiseScheduler
  ): Promise<Chunk> {
    if (lod >= this.lods_) {
      throw new Error(
        `Invalid LOD index: ${lod}. Only ${this.lods_} lod(s) available`
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
      chunkIndex: { x: 0, y: 0, z: 0, c: 0 },
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

function sliceChunkIndex(dim: SliceDimension, attrs: LoaderAttributes): number {
  const { sourceIndex, pointWorld } = dim;
  const { scale, translation } = attrs;
  const dataIndex = Math.round(
    (pointWorld - translation[sourceIndex]) / scale[sourceIndex]
  );
  return Math.floor(dataIndex / attrs.chunks[sourceIndex]);
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

function findRegionPointValue(region: Region, dimension: string): number {
  const entry = region.find((r) => compareDimensions(r.dimension, dimension));
  if (!entry) {
    throw new Error(
      `Region must contain an entry for the "${dimension}" dimension since the source has a "${dimension}" dimension.`
    );
  }
  if (entry.index.type !== "point") {
    throw new Error(
      `Region entry for "${dimension}" dimension has type "${entry.index.type}". ` +
        `It must be of type "point".`
    );
  }
  return entry.index.value;
}
