import * as zarr from "zarrita";
import { Group, Location, open as openZarr } from "@zarrita/core";
import FetchStore from "@zarrita/storage/fetch";
import { Readable } from "@zarrita/storage";
import { Slice } from "@zarrita/indexing";
import {
  Dimension,
  DimensionMapping,
  DimensionMappingProps,
  VirtualCamera2D,
} from "./dimensions";
import { Image as OmeZarrImage } from "../data/ome_ngff/0.4/image";

type OmeZarrChunkSourceProps = {
  group: Group<Readable>;
  metadata: OmeZarrImage["multiscales"][number];
  dimensions: DimensionMapping;
};

type Chunk = {
  data: ArrayBuffer | null;
  lod: number;
  shape: {
    x: number;
    y: number;
    c: number;
  };
  chunkIndex: {
    x: number;
    y: number;
  };
  scale: {
    x: number;
    y: number;
  };
  offset: {
    x: number;
    y: number;
  };
};

type Dataset = {
  path: string;
  scale: number[];
  translation: number[];
};

export class OmeZarrChunkSource {
  private readonly group_: Group<Readable>;
  private readonly metadata_: OmeZarrImage["multiscales"][number];
  // Maps from a dimension name to its index in a dataset array.
  private readonly dimensions_: DimensionMapping;
  private readonly datasets_: ReadonlyArray<Dataset>;

  private constructor(props: OmeZarrChunkSourceProps) {
    this.group_ = props.group;
    this.metadata_ = props.metadata;
    this.dimensions_ = props.dimensions;
    this.datasets_ = getDatasetAttributes(this.metadata_);
  }

  public get dimensions() {
    return this.dimensions_;
  }

  // This is similar to OmeZarrImageLoader.loadChunk
  public async loadMetaChunk(camera: VirtualCamera2D) {
    const lod = camera.lod ?? 0;
    const array = await openZarr.v2(
      this.group_.resolve(this.metadata_.datasets[lod].path),
      { kind: "array", attrs: false }
    );
    const indices = this.getArrayIndices(camera);
    const subarray = await zarr.get(array, indices);
    return {
      data: subarray.data,
      shape: subarray.shape,
      dtype: array.dtype,
    };
  }

  public async getAllChunks(): Promise<Chunk[]> {
    const xIndex = this.dimensions_.x.index;
    const yIndex = this.dimensions_.y.index;
    // From ChunkManagerSource constructor
    const chunks: Chunk[] = [];
    for (let lod = 0; lod < this.datasets_.length; ++lod) {
      const dataset = this.datasets_[lod];
      const array = await openZarr.v2(this.group_.resolve(dataset.path), {
        kind: "array",
        attrs: false,
      });
      const arrayShape = array.shape;
      const chunkShape = array.chunks;
      const chunkWidth = chunkShape[xIndex];
      const chunkHeight = chunkShape[yIndex];
      const chunksX = Math.ceil(arrayShape[xIndex] / chunkWidth);
      const chunksY = Math.ceil(arrayShape[yIndex] / chunkHeight);
      const scale = dataset.scale;
      const translation = dataset.translation;
      // TODO: handle case when c dimension
      const numChannels = this.dimensions_.c
        ? arrayShape[this.dimensions_.c.index]
        : 1;
      for (let x = 0; x < chunksX; ++x) {
        for (let y = 0; y < chunksY; ++y) {
          chunks.push({
            data: null,
            lod,
            shape: {
              x: chunkWidth,
              y: chunkHeight,
              c: numChannels,
            },
            chunkIndex: { x, y },
            scale: {
              x: scale[xIndex],
              y: scale[yIndex],
            },
            offset: {
              x: translation[xIndex] + x * chunkWidth * scale[xIndex],
              y: translation[yIndex] + y * chunkHeight * scale[yIndex],
            },
          });
        }
      }
    }
    return chunks;
  }

  // This is similar to OmeZarrImageLoader.loadChunkDataFromRegion
  public async loadChunkData(chunk: Chunk, camera: VirtualCamera2D) {
    const lod = chunk.lod;
    const dataset = this.datasets_[lod];
    const array = await openZarr.v2(this.group_.resolve(dataset.path), {
      kind: "array",
      attrs: false,
    });

    const translation = dataset.translation;
    const scale = dataset.scale;

    const chunkIndex: number[] = [];
    chunkIndex[this.dimensions_.x.index] = chunk.chunkIndex.x;
    chunkIndex[this.dimensions_.y.index] = chunk.chunkIndex.y;
    let zIndex: number;
    if (this.dimensions_.z) {
      if (camera.z === undefined) {
        throw new Error(
          "Camera must specify z coordinate when z dimension is present."
        );
      }
      const zTranslation = translation[this.dimensions_.z.index];
      const zScale = scale[this.dimensions_.z.index];
      zIndex = Math.round((camera.z - zTranslation) / zScale);
      const zChunkIndex = Math.floor(
        zIndex / array.chunks[this.dimensions_.z.index]
      );
      chunkIndex[this.dimensions_.z.index] = zChunkIndex;
    }

    // TODO: fix this
    if (this.dimensions_.c) {
      if (camera.c === undefined) {
        throw new Error(
          "Camera must specify c coordinate when c dimension is present."
        );
      }
      chunkIndex[this.dimensions_.c.index] = camera.c;
    }

    if (this.dimensions_.t) {
      if (camera.t === undefined) {
        throw new Error(
          "Camera must specify t coordinate when t dimension is present."
        );
      }
      const tTranslation = translation[this.dimensions_.t.index];
      const tScale = scale[this.dimensions_.t.index];
      const tIndex = Math.round((camera.t - tTranslation) / tScale);
      const tChunkIndex = Math.floor(
        tIndex / array.chunks[this.dimensions_.t.index]
      );
      chunkIndex[this.dimensions_.t.index] = tChunkIndex;
    }
    console.debug(
      `Loading chunk data for chunkIndex: ${chunkIndex}, lod: ${lod}`
    );
    const subarray = await array.getChunk(chunkIndex);
    // TODO: support other data types
    const data = subarray.data as Uint16Array;

    // TODO: calculate offset based on zIndex, tIndex, and stride.
    const sliceSize = chunk.shape.x * chunk.shape.y;
    let offset = 0;
    if (this.dimensions_.z) {
      offset = zIndex! % array.chunks[this.dimensions_.z.index];
    }
    chunk.data = data.slice(offset, offset + sliceSize);
  }

  private getArrayIndices(camera: VirtualCamera2D): Array<Slice | number> {
    const numDimensions = this.datasets_.length;
    const indices: Array<Slice | number> = new Array(numDimensions).fill(
      zarr.slice(null)
    );

    const lod = camera.lod ?? 0;
    const datasetAttrs = this.datasets_[lod];
    const translation = datasetAttrs.translation;
    const scale = datasetAttrs.scale;

    const xTranslation = translation[this.dimensions_.x.index];
    const xScale = scale[this.dimensions_.x.index];
    const xStart = Math.floor((camera.x.start - xTranslation) / xScale);
    const xEnd = Math.ceil((camera.x.end - xTranslation) / xScale);
    const xIndex = zarr.slice(xStart, xEnd);
    indices[this.dimensions_.x.index] = xIndex;

    const yTranslation = translation[this.dimensions_.y.index];
    const yScale = scale[this.dimensions_.y.index];
    const yStart = Math.floor((camera.y.start - yTranslation) / yScale);
    const yEnd = Math.ceil((camera.y.end - yTranslation) / yScale);
    const yIndex = zarr.slice(yStart, yEnd);
    indices[this.dimensions_.y.index] = yIndex;

    if (this.dimensions_.z) {
      if (camera.z === undefined) {
        throw new Error(
          "Camera must specify z coordinate when z dimension is present."
        );
      }
      const zTranslation = translation[this.dimensions_.z.index];
      const zScale = scale[this.dimensions_.z.index];
      const zIndex = Math.round((camera.z - zTranslation) / zScale);
      indices[this.dimensions_.z.index] = zIndex;
    }

    if (this.dimensions_.c) {
      if (camera.c === undefined) {
        throw new Error(
          "Camera must specify c coordinate when c dimension is present."
        );
      }
      indices[this.dimensions_.c.index] = camera.c;
    }

    if (this.dimensions_.t) {
      if (camera.t === undefined) {
        throw new Error(
          "Camera must specify t coordinate when t dimension is present."
        );
      }
      const tTranslation = translation[this.dimensions_.t.index];
      const tScale = scale[this.dimensions_.t.index];
      const tIndex = Math.round((camera.t - tTranslation) / tScale);
      indices[this.dimensions_.t.index] = tIndex;
    }

    return indices;
  }

  public static async fromUrl(
    url: string,
    dimensionProps?: DimensionMappingProps
  ): Promise<OmeZarrChunkSource> {
    const store = new FetchStore(url);
    const group = await openZarr.v2(new Location(store), { kind: "group" });
    const images = OmeZarrImage.parse(group.attrs).multiscales;
    if (images.length > 1) {
      throw new Error(
        `Currently only a single multiscale image is supported. Found ${images.length} images.`
      );
    }
    const image = images[0];
    const dataset = image.datasets[0];
    const axes = image.axes;
    const array = await openZarr.v2(group.resolve(dataset.path), {
      kind: "array",
      attrs: false,
    });
    const shape = array.shape;
    if (axes.length !== shape.length) {
      throw new Error(
        `Mismatch between number of axes (${axes.length}) and array shape (${array.shape.length})`
      );
    }
    const dimensions =
      dimensionProps === undefined
        ? inferDimensionMapping(axes, shape)
        : validateDimensionMappingProps(axes, shape, dimensionProps);
    return new OmeZarrChunkSource({ group, metadata: image, dimensions });
  }
}

function inferDimensionMapping(
  axes: OmeZarrImage["multiscales"][number]["axes"],
  shape: number[]
): DimensionMapping {
  const x = findDimension(axes, shape, "x", false);
  if (x === undefined) {
    throw new Error('Could not find "x" axis');
  }
  const y = findDimension(axes, shape, "y", false);
  if (y === undefined) {
    throw new Error('Could not find "y" axis');
  }
  const z = findDimension(axes, shape, "z", false);
  const c = findDimension(axes, shape, "c", false);
  const t = findDimension(axes, shape, "t", false);
  return { x, y, z, t, c };
}

function validateDimensionMappingProps(
  axes: OmeZarrImage["multiscales"][number]["axes"],
  shape: number[],
  dimensionProps: DimensionMappingProps
): DimensionMapping {
  const x = findDimension(axes, shape, dimensionProps.x.name);
  if (x === undefined) {
    throw new Error(`Could not find "${dimensionProps.x.name}" axis`);
  }
  if (x.index !== axes.length - 1) {
    throw new Error(`X axis must be the last axis in the data.
        Found at index ${x.index} of ${axes.length}`);
  }

  const y = findDimension(axes, shape, dimensionProps.y.name);
  if (y === undefined) {
    throw new Error(`Could not find "${dimensionProps.y.name}" axis`);
  }
  if (y.index !== axes.length - 2) {
    throw new Error(`Y axis must be the second to last axis in the data.
        Found at index ${y.index} of ${axes.length}`);
  }

  let z;
  if (dimensionProps.z) {
    z = findDimension(axes, shape, dimensionProps.z.name);
    if (z === undefined) {
      throw new Error(`Could not find "${dimensionProps.z.name}" axis`);
    }
    if (z.index !== axes.length - 3) {
      throw new Error(`Z axis must be the third to last axis in the data.
          Found at index ${z.index} of ${axes.length}`);
    }
  }

  let t;
  if (dimensionProps.t) {
    t = findDimension(axes, shape, dimensionProps.t.name);
    if (t === undefined) {
      throw new Error(`Could not find "${dimensionProps.t.name}" axis`);
    }
    if (t.index !== 0) {
      throw new Error(`T axis must be the first axis in the data.
          Found at index ${t.index} of ${axes.length}`);
    }
  }

  let c;
  if (dimensionProps.c) {
    c = findDimension(axes, shape, dimensionProps.c.name);
    if (c === undefined) {
      throw new Error(`Could not find "${dimensionProps.c.name}" axis`);
    }
    if (t && c.index !== 1) {
      throw new Error(`When T is present C axis must be the second axis in the data.
          Found at index ${c.index} of ${axes.length}`);
    }
    if (!t && c.index !== 0) {
      throw new Error(`When T is not present C axis must be the first axis in the data.
          Found at index ${c.index} of ${axes.length}`);
    }
  }
  return { x, y, z, c, t };
}

function findDimension(
  axes: OmeZarrImage["multiscales"][number]["axes"],
  shape: number[],
  name: string,
  caseSensitive: boolean = true
): Dimension | undefined {
  const index = axes.findIndex((a) => {
    const axisName = caseSensitive ? a.name : a.name.toLowerCase();
    const targetName = caseSensitive ? name : name.toLowerCase();
    return axisName === targetName;
  });
  if (index === -1) return;
  return {
    name,
    index,
    length: shape[index],
    unit: axes[index].unit,
  };
}

function getDatasetAttributes(image: OmeZarrImage["multiscales"][number]) {
  const output: Dataset[] = [];
  const numAxes = image.axes.length;
  for (const dataset of image.datasets) {
    const path = dataset.path;
    const scale = dataset.coordinateTransformations[0].scale;
    const translation =
      dataset.coordinateTransformations.length === 2
        ? dataset.coordinateTransformations[1].translation
        : new Array(numAxes).fill(0);
    output.push({
      path,
      scale,
      translation,
    });
  }
  return output;
}
