import * as zarr from "zarrita";

import { Chunk, SourceDimension, SourceDimensionMap } from "../chunk";
import { isTextureUnpackRowAlignment } from "../../objects/textures/texture";
import { PromiseScheduler } from "../promise_scheduler";

import { Image as OmeZarrImage } from "./0.5/image";

import { ZarrArrayParams } from "../zarr/open";
import { SliceSpec } from "./chunk_processing";
import { fetchAndProcessChunk } from "./worker_pool";

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
    const { x, y, z, c, t } = this.dimensions_;
    // x and y always have a real source-array index (any source is at
    // least 2D). z, c, t may be synthetic placeholders (index undefined)
    // for axes the source doesn't have.
    if (x.index === undefined || y.index === undefined) {
      throw new Error(
        "OmeZarrImageLoader: x and y must map to real source-array axes"
      );
    }

    const chunkCoords: number[] = [];
    chunkCoords[x.index] = chunk.chunkIndex.x;
    chunkCoords[y.index] = chunk.chunkIndex.y;
    if (z.index !== undefined) {
      chunkCoords[z.index] = chunk.chunkIndex.z;
    }

    // internal (ChunkStore) chunks have size 1 in C and T
    // so divide by the actual chunkSize to get the chunkCoord here
    const cLod = c.lods[chunk.lod];
    if (c.index !== undefined) {
      chunkCoords[c.index] = Math.floor(chunk.chunkIndex.c / cLod.chunkSize);
    }
    const tLod = t.lods[chunk.lod];
    if (t.index !== undefined) {
      chunkCoords[t.index] = Math.floor(chunk.chunkIndex.t / tLod.chunkSize);
    }

    const array = this.arrays_[chunk.lod];
    const arrayParams = this.arrayParams_[chunk.lod];

    const sliceSpec: SliceSpec = {
      targetShape: chunk.shape,
      chunkIndex: { c: chunk.chunkIndex.c, t: chunk.chunkIndex.t },
      dimIndices: {
        x: x.index,
        y: y.index,
        z: z.index,
        c: c.index,
        t: t.index,
      },
      cChunkSize: c.index !== undefined ? cLod.chunkSize : undefined,
      tChunkSize: t.index !== undefined ? tLod.chunkSize : undefined,
    };

    // NOTE: if source chunks have multiple channels/timepoints
    // this results in duplicate fetching and decompression
    const data = await fetchAndProcessChunk(
      array,
      arrayParams,
      chunkCoords,
      sliceSpec,
      { signal }
    );

    const rowAlignment = data.BYTES_PER_ELEMENT;
    if (!isTextureUnpackRowAlignment(rowAlignment)) {
      throw new Error(
        "Invalid row alignment value. Possible values are 1, 2, 4, or 8"
      );
    }
    chunk.rowAlignmentBytes = rowAlignment;
    chunk.data = data;
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
    // Normalize translations on spatial axes so chunk.offset = trans + chunkIdx
    // * chunkSize * scale uniformly refers to the voxel-cell corner. Two
    // conventions appear in the wild: "voxel-center" pyramids encode the
    // half-voxel shift across LODs (translation_k - translation_{k-1} === 0.5
    // * (scale_k - scale_{k-1})), "voxel-corner" pyramids keep translation
    // constant. Detect by inspecting the pyramid; if it matches the center
    // pattern, shift translations by -0.5 * scale per LOD so downstream code
    // uses corner extents uniformly. Skip non-spatial axes (c, t) where the
    // convention doesn't apply and ChunkStore enforces translation == 0.
    if (image.axes[index].type === "space" && isVoxelCenterConvention(lods)) {
      for (const lod of lods) lod.translation -= 0.5 * lod.scale;
    }
    return {
      name,
      index,
      unit: image.axes[index].unit,
      lods,
    };
  };

  // use a size-1 placeholder with index: undefined for axes not present in the source
  const placeholder = (name: string): SourceDimension => ({
    name,
    lods: Array.from({ length: arrays.length }, () => ({
      size: 1,
      chunkSize: 1,
      scale: 1,
      translation: 0,
    })),
  });
  const lookup = (target: string): SourceDimension => {
    const idx = findDimensionIndexSafe(dimensionNames, target);
    return idx !== -1
      ? makeSourceDimension(dimensionNames[idx], idx)
      : placeholder(target);
  };

  return {
    x: makeSourceDimension(dimensionNames[xIndex], xIndex),
    y: makeSourceDimension(dimensionNames[yIndex], yIndex),
    z: lookup("z"),
    c: lookup("c"),
    t: lookup("t"),
    numLods: arrays.length,
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

function isVoxelCenterConvention(
  lods: ReadonlyArray<{ scale: number; translation: number }>
): boolean {
  if (lods.length <= 1) return false;
  for (let i = 1; i < lods.length; i++) {
    const expected = 0.5 * (lods[i].scale - lods[i - 1].scale);
    const actual = lods[i].translation - lods[i - 1].translation;
    if (Math.abs(actual - expected) > 1e-6) return false;
  }
  return true;
}
