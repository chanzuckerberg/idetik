import * as zarr from "zarrita";
import { Slice } from "@zarrita/indexing";

import { Box, Region } from "data/region";
import { ImageChunk } from "data/image_chunk";
import { isTextureUnpackRowAlignment } from "objects/textures/texture";

type IdentityTransform = {
  type: "identity";
};

type TranslationTransform = {
  type: "translation";
  translation: Array<number>;
};

type ScaleTransform = {
  type: "scale";
  scale: Array<number>;
};

type Transform = IdentityTransform | TranslationTransform | ScaleTransform;

type Dataset = {
  path: string;
  coordinateTransformations: Array<Transform>;
};

type Axis = {
  name: string;
  type?: string;
};

type Multiscale = {
  axes: Array<Axis>;
  datasets: Array<Dataset>;
};

const dataTypes = [Uint8Array, Uint16Array] as const;
const dataTypeNames = dataTypes.map((DataType) => DataType.name);
type DataType = InstanceType<(typeof dataTypes)[number]>;

function isDataType(value: unknown): value is DataType {
  return dataTypes.some((DataType) => value instanceof DataType);
}

// Loads chunks from a multiscale zarr image implementing OME-NGFF v0.4:
// https://ngff.openmicroscopy.org/0.4/#image-layout
export class OmeZarrImageLoader {
  root_: zarr.Group<zarr.FetchStore>;
  axes_: Array<Axis>;
  datasets_: Array<Dataset>;

  constructor(root: zarr.Group<zarr.FetchStore>) {
    this.root_ = root;
    if (!("multiscales" in this.root_.attrs)) {
      throw new Error(`multiscales property not found in root ${root}`);
    }
    const multiscales = this.root_.attrs.multiscales as Array<Multiscale>;
    if (multiscales.length !== 1) {
      throw new Error(
        `Can only handle one multiscale image. Found ${multiscales.length}`
      );
    }
    const image = multiscales[0];
    this.axes_ = image.axes;
    this.datasets_ = image.datasets;
  }

  async loadChunk(region: Region): Promise<ImageChunk> {
    // TODO: use the input to determine what level to load.
    // https://github.com/chanzuckerberg/imaging-active-learning/issues/37
    const lowestResolutionIndex = this.datasets_.length - 1;
    const dataset = this.datasets_[lowestResolutionIndex];

    console.debug("loading dataset", dataset);
    const array = await zarr.open.v2(this.root_.resolve(dataset.path), {
      kind: "array",
      attrs: false,
    });
    console.debug("opened array", array);

    const [indices, chunkRegion] = regionToIndices(region, dataset, this.axes_);
    console.debug("loading subarray with indices", indices);
    const subarray = await zarr.get(array, indices);

    if (!isDataType(subarray.data)) {
      throw new Error(
        `Subarray has an unsupported data type ${subarray.data.constructor.name}. Supported data types are ${dataTypeNames}.`
      );
    }

    const rowAlignment = subarray.data.BYTES_PER_ELEMENT;
    if (!isTextureUnpackRowAlignment(rowAlignment)) {
      throw new Error(
        "Invalid row alignment value. Possible values are 1, 2, 4, or 8"
      );
    }

    const extent = getExtent(this.axes_, dataset, array);
    const clampedRegion = clampBox(chunkRegion, extent);

    const chunk = {
      data: subarray.data,
      shape: subarray.shape,
      stride: subarray.stride,
      region: clampedRegion,
      rowAlignmentBytes: rowAlignment,
    };
    console.debug("loaded chunk ", chunk);
    return chunk;
  }

  async *loadChunks(region: Region): AsyncGenerator<ImageChunk> {
    // TODO: use the input to determine what level to load.
    // https://github.com/chanzuckerberg/imaging-active-learning/issues/37
    const lowestResolutionIndex = this.datasets_.length - 1;
    const dataset = this.datasets_[lowestResolutionIndex];

    console.debug("loading dataset", dataset);
    const array = await zarr.open.v2(this.root_.resolve(dataset.path), {
      kind: "array",
      attrs: false,
    });
    console.debug("opened array", array, array.shape, array.chunks);

    const [indices, _chunkRegion] = regionToIndices(
      region,
      dataset,
      this.axes_
    );
    const extent = getExtent(this.axes_, dataset, array);

    const chunkShape = array.chunks;
    // The number of elements is the number of dimensions in the array.
    // Each sub-element is a slice that is clamped to a chunk.
    const chunkedIndices: Array<Array<Slice | number>> = [];
    for (let i = 0; i < chunkShape.length; ++i) {
      const index = indices[i];
      if (typeof index === "number") {
        chunkedIndices.push([index]);
        continue;
      }
      if (index.start === null) {
        index.start = 0;
      }
      if (index.stop === null) {
        index.stop = array.shape[i];
      }
      const chunkIndices: Slice[] = [];
      let j = index.start;
      if (j % chunkShape[i] !== 0) {
        const k = chunkShape[i] * Math.ceil(index.start / chunkShape[i]);
        chunkIndices.push(zarr.slice(index.start, k));
        j = k;
      }
      while (j < index.stop) {
        const k = Math.min(j + chunkShape[i], index.stop);
        chunkIndices.push(zarr.slice(j, k));
        j = k;
      }
      chunkedIndices.push(chunkIndices);
    }
    console.debug("chunkedIndices", chunkedIndices);

    // The number of elements is the number of chunks we will fetch.
    // Each sub-element is an index that can be used as an index for zarr.get.
    const allChunkIndices = cartesianProduct(...chunkedIndices);
    console.debug("allChunkIndices", allChunkIndices);
    for (const chunkIndices of allChunkIndices) {
      console.debug("loading subarray with indices", chunkIndices);
      const subarray = await zarr.get(array, chunkIndices);
      console.debug("loaded subarray", subarray);

      if (!isDataType(subarray.data)) {
        throw new Error(
          `Subarray has an unsupported data type ${subarray.data.constructor.name}. Supported data types are ${dataTypeNames}.`
        );
      }

      const rowAlignment = subarray.data.BYTES_PER_ELEMENT;
      if (!isTextureUnpackRowAlignment(rowAlignment)) {
        throw new Error(
          "Invalid row alignment value. Possible values are 1, 2, 4, or 8"
        );
      }

      const cr: Box = new Map();
      for (let i = 0; i < this.axes_.length; ++i) {
        const index = chunkIndices[i];
        if (typeof index === "number") continue;
        if (index.start === null || index.stop === null) {
          cr.set(this.axes_[i].name, {
            start: -Infinity,
            stop: Infinity,
          });
          continue;
        }
        const scale = getScale(dataset, i);
        cr.set(this.axes_[i].name, {
          start: index.start * scale,
          stop: index.stop * scale,
        });
      }
      const clampedRegion = clampBox(cr, extent);

      const chunk = {
        data: subarray.data,
        shape: subarray.shape,
        stride: subarray.stride,
        region: clampedRegion,
        rowAlignmentBytes: rowAlignment,
      };
      console.debug("loaded chunk ", chunk);

      yield chunk;
    }
  }
}

function getExtent(
  axes: Array<Axis>,
  dataset: Dataset,
  array: zarr.Array<zarr.DataType>
): Box {
  const extent: Box = new Map();
  for (const [i, axis] of axes.entries()) {
    const scale = getScale(dataset, i);
    extent.set(axis.name, { start: 0, stop: array.shape[i] * scale });
  }
  return extent;
}

function getScale(dataset: Dataset, index: number): number {
  // TODO: handle more than just scale list to transform input region.
  // https://github.com/chanzuckerberg/imaging-active-learning/issues/38
  return dataset.coordinateTransformations
    .map((transform) => transformScale(transform, index))
    .reduce((totalScale, scale) => scale * totalScale, 1);
}

function cartesianProduct<T>(...arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (acc, currArray) => {
      const result: T[][] = [];
      acc.forEach((a) => {
        currArray.forEach((b) => {
          result.push([...a, b]);
        });
      });
      return result;
    },
    [[]]
  );
}

// Converts a region to indices within an OME-Zarr image array.
function regionToIndices(
  region: Region,
  dataset: Dataset,
  axes: Array<Axis>
): [Array<Slice | number>, Box] {
  const indices: Array<Slice | number> = [];
  const indicesRegion: Box = new Map();
  for (const [i, axis] of axes.entries()) {
    const scale = getScale(dataset, i);
    // If a match was not found use a null slice which represents
    // the complete extent of a dimension like Python's `slice(None)`.
    let index: Slice | number = zarr.slice(null);
    const regionIndex = region.get(axis.name);
    if (regionIndex !== undefined) {
      if (typeof regionIndex === "number") {
        index = Math.round(regionIndex / scale);
      } else {
        index = zarr.slice(
          Math.floor(regionIndex.start / scale),
          Math.ceil(regionIndex.stop / scale)
        );
        indicesRegion.set(axis.name, regionIndex);
      }
    } else {
      indicesRegion.set(axis.name, { start: -Infinity, stop: Infinity });
    }
    indices.push(index);
  }
  return [indices, indicesRegion];
}

// Returns a scale from a transform at some axis index or 1 if a scale cannot be found.
function transformScale(transform: Transform, index: number): number {
  if (transform.type !== "scale") return 1;
  if (!(transform.scale instanceof Array)) return 1;
  return transform.scale[index];
}

function clampBox(region: Box, bounds: Box): Box {
  const clamped: Box = new Map();
  for (const [name, index] of region) {
    const bound = bounds.get(name);
    if (bound === undefined) continue;
    const start = Math.max(index.start, bound.start);
    const stop = Math.min(index.stop, bound.stop);
    clamped.set(name, { start, stop });
  }
  return clamped;
}
