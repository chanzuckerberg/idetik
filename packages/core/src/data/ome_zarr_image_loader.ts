import * as zarr from "zarrita";
import { Slice } from "@zarrita/indexing";

import { Region, Region2D } from "../data/region";
import {
  Chunk,
  ChunkedArrayDimension,
  ChunkedArrayDimensions,
  DimensionMapping,
  isChunkData,
  LoaderAttributes,
} from "./chunk";
import { isTextureUnpackRowAlignment } from "../objects/textures/texture";
import { PromiseScheduler } from "./promise_scheduler";

import { Image as OmeNgffImage } from "../data/ome_ngff/0.4/image";

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
  metadata: OmeNgffImage["multiscales"][number];
  arrays: zarr.Array<zarr.DataType, Readable>[];
  dimensionMapping?: DimensionMapping;
};

// Loads chunks from a multiscale zarr image implementing OME-NGFF v0.4:
// https://ngff.openmicroscopy.org/0.4/#image-layout
export class OmeZarrImageLoader {
  private readonly metadata_: OmeNgffImage["multiscales"][number];
  private readonly arrays_: ReadonlyArray<zarr.Array<zarr.DataType, Readable>>;
  private readonly lods_: number;
  private readonly loaderAttributes_: ReadonlyArray<LoaderAttributes>;
  private readonly dimensions_: ReadonlyArray<ChunkedArrayDimensions>;

  constructor(props: OmeZarrImageLoaderProps) {
    this.metadata_ = props.metadata;
    this.arrays_ = props.arrays;
    this.loaderAttributes_ = getLoaderAttributes(this.metadata_, this.arrays_);
    this.dimensions_ = getChunkedArrayDimensions(
      this.metadata_,
      this.arrays_,
      props.dimensionMapping
    );
    this.lods_ = this.metadata_.datasets.length;
  }

  public async loadChunkDataFromRegion(chunk: Chunk, region: Region2D) {
    const array = this.arrays_[chunk.lod];
    const dimension = this.dimensions_[chunk.lod];

    const chunkCoords: number[] = [];
    chunkCoords[dimension.x.index] = chunk.chunkIndex.x;
    chunkCoords[dimension.y.index] = chunk.chunkIndex.y;
    if (dimension.z) {
      if (!region.z) {
        throw new Error("Region must specify a z index to load data with z.");
      }
      const index =
        (region.z.value - dimension.z.translation) / dimension.z.scale;
      chunkCoords[dimension.z.index] = Math.floor(
        index / dimension.z.chunkSize
      );
    }
    if (dimension.c) {
      if (!region.c) {
        throw new Error("Region must specify a c index to load data with c.");
      }
      // TODO: handle this more specifically.
      if (region.c.type === "full") {
        throw new Error(
          "Region c index cannot be 'full' when loading chunk data."
        );
      }
      chunkCoords[dimension.c.index] = Math.floor(region.c.value / dimension.c.chunkSize);
    }
    if (dimension.t) {
      if (!region.t) {
        throw new Error("Region must specify a t index to load data with t.");
      }
      const index =
        (region.t.value - dimension.t.translation) / dimension.t.scale;
      chunkCoords[dimension.t.index] = Math.floor(
        index / dimension.t.chunkSize
      );
    }

    const subarray = await array.getChunk(chunkCoords);

    const data = subarray.data;
    if (!isChunkData(data)) {
      throw new Error(
        `Subarray has an unsupported data type, data=${data.constructor.name}`
      );
    }

    // TODO: should not be sliced here.
    const sliceSize = chunk.shape.x * chunk.shape.y;
    let zOffset = 0;
    if (region.z) {
      // TODO: I think dimension.z must be defined here, but double check.
      const zIndex = Math.round(
        (region.z.value - dimension.z!.translation) / dimension.z!.scale
      );
      zOffset = (zIndex % dimension.z!.chunkSize) * sliceSize;
    }
    chunk.data = data.slice(zOffset, zOffset + sliceSize);
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

  public getDimensions(): ReadonlyArray<ChunkedArrayDimensions> {
    return this.dimensions_;
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
  image: OmeNgffImage["multiscales"][number],
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

function inferDimensionMapping(
  axes: OmeNgffImage["multiscales"][number]["axes"]
): DimensionMapping {
  const xIndex = findDimension("x", axes, false);
  if (xIndex === undefined) {
    throw new Error('Could not find "x" axis');
  }
  const yIndex = findDimension("y", axes, false);
  if (yIndex === undefined) {
    throw new Error('Could not find "y" axis');
  }
  const zIndex = findDimension("z", axes, false);
  const cIndex = findDimension("c", axes, false);
  const tIndex = findDimension("t", axes, false);
  return {
    x: axes[xIndex].name,
    y: axes[yIndex].name,
    z: axes[zIndex]?.name,
    c: axes[cIndex]?.name,
    t: axes[tIndex]?.name,
  };
}

function findDimension(
  name: string,
  axes: OmeNgffImage["multiscales"][number]["axes"],
  caseSensitive: boolean = true
): number {
  return axes.findIndex((a) => {
    const axisName = caseSensitive ? a.name : a.name.toLowerCase();
    const targetName = caseSensitive ? name : name.toLowerCase();
    return axisName === targetName;
  });
}

function getChunkedArrayDimensions(
  image: OmeNgffImage["multiscales"][number],
  arrays: ReadonlyArray<zarr.Array<zarr.DataType, Readable>>,
  dimensions?: DimensionMapping
): ReadonlyArray<ChunkedArrayDimensions> {
  if (!dimensions) {
    dimensions = inferDimensionMapping(image.axes);
    console.debug("Inferred dimension mapping:", dimensions);
  }
  const { xIndex, yIndex, zIndex, cIndex, tIndex } = getDimensionIndices(
    dimensions,
    image.axes
  );
  const result: ChunkedArrayDimensions[] = [];
  for (let i = 0; i < image.datasets.length; i++) {
    const x = getChunkedArrayDimension(image, arrays, i, xIndex);
    const y = getChunkedArrayDimension(image, arrays, i, yIndex);
    const z =
      zIndex !== undefined
        ? getChunkedArrayDimension(image, arrays, i, zIndex)
        : undefined;
    const c =
      cIndex !== undefined
        ? getChunkedArrayDimension(image, arrays, i, cIndex)
        : undefined;
    const t =
      tIndex !== undefined
        ? getChunkedArrayDimension(image, arrays, i, tIndex)
        : undefined;
    result.push({
      x,
      y,
      z,
      c,
      t,
    });
  }
  return result;
}

function getDimensionIndices(
  dimensions: DimensionMapping,
  axes: OmeNgffImage["multiscales"][number]["axes"]
) {
  const xIndex = findDimension(dimensions.x, axes);
  if (xIndex === -1) {
    throw new Error(`Could not find "${dimensions.x}" axis`);
  }
  if (xIndex !== axes.length - 1) {
    throw new Error(`X axis must be the last axis in the data.
        Found at index ${xIndex} of ${axes.length}`);
  }

  const yIndex = findDimension(dimensions.y, axes);
  if (yIndex === -1) {
    throw new Error(`Could not find "${dimensions.y}" axis`);
  }
  if (yIndex !== axes.length - 2) {
    throw new Error(`Y axis must be the second to last axis in the data.
        Found at index ${yIndex} of ${axes.length}`);
  }

  let zIndex;
  if (dimensions.z) {
    zIndex = findDimension(dimensions.z, axes);
    if (zIndex === -1) {
      throw new Error(`Could not find "${dimensions.z}" axis`);
    }
    if (zIndex !== axes.length - 3) {
      throw new Error(`Z axis must be the third to last axis in the data.
          Found at index ${zIndex} of ${axes.length}`);
    }
  }

  let tIndex: number = -1;
  if (dimensions.t) {
    tIndex = findDimension(dimensions.t, axes);
    if (tIndex === -1) {
      throw new Error(`Could not find "${dimensions.t}" axis`);
    }
    if (tIndex !== 0) {
      throw new Error(`T axis must be the first axis in the data.
          Found at index ${tIndex} of ${axes.length}`);
    }
  }

  let cIndex;
  if (dimensions.c) {
    cIndex = findDimension(dimensions.c, axes);
    if (cIndex === -1) {
      throw new Error(`Could not find "${dimensions.c}" axis`);
    }
    if (tIndex !== -1 && cIndex !== 1) {
      throw new Error(`When T is present C axis must be the second axis in the data.
          Found at index ${cIndex} of ${axes.length}`);
    }
    if (tIndex === -1 && cIndex !== 0) {
      throw new Error(`When T is not present C axis must be the first axis in the data.
          Found at index ${cIndex} of ${axes.length}`);
    }
  }

  return { xIndex, yIndex, zIndex, cIndex, tIndex };
}

function getChunkedArrayDimension(
  image: OmeNgffImage["multiscales"][number],
  arrays: ReadonlyArray<zarr.Array<zarr.DataType, Readable>>,
  datasetIndex: number,
  axisIndex: number
): ChunkedArrayDimension {
  const axis = image.axes[axisIndex];
  const dataset = image.datasets[datasetIndex];
  const array = arrays[datasetIndex];
  const transforms = dataset.coordinateTransformations;
  const scale = transforms[0].scale[axisIndex];
  const translation = transforms[1]?.translation[axisIndex] ?? 0;
  return {
    name: axis.name,
    index: axisIndex,
    size: array.shape[axisIndex],
    chunkSize: array.chunks[axisIndex],
    scale,
    translation,
    unit: axis.unit,
  };
}
