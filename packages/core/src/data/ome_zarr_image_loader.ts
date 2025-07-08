import * as zarr from "zarrita";
import { Slice } from "@zarrita/indexing";

import { Region } from "../data/region";
import {
  ImageChunk,
  isImageChunkData,
  LoaderAttributes,
} from "../data/image_chunk";
import { isTextureUnpackRowAlignment } from "../objects/textures/texture";
import { PromiseScheduler } from "./promise_scheduler";

import { Image as OmeNgffImage } from "../data/ome_ngff/0.4/image";
import { parseOmeNgffImage } from "../data/ome_zarr_hcs_metadata_loader";

type ImageAttributes = {
  image: OmeNgffImage["multiscales"][number];
  dimensionNames: string[];
  datasetPath: string;
  scale: number[];
  translation: number[];
};

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

// Loads chunks from a multiscale zarr image implementing OME-NGFF v0.4:
// https://ngff.openmicroscopy.org/0.4/#image-layout
export class OmeZarrImageLoader {
  private readonly root_: zarr.Group<zarr.FetchStore>;
  private readonly metadata_: OmeNgffImage;
  private readonly lods_: number;

  constructor(root: zarr.Group<zarr.FetchStore>) {
    this.root_ = root;
    this.metadata_ = parseOmeNgffImage(this.root_);
    if (this.metadata_.multiscales.length !== 1) {
      throw new Error(
        `Can only handle one multiscale image. Found ${this.metadata_.multiscales.length}`
      );
    }

    this.lods_ = this.metadata_.multiscales[0].datasets.length;
  }

  public async loadChunkDataFromRegion(chunk: ImageChunk, region: Region) {
    const attrs = this.getImageAttributes()[chunk.lod];
    const array = await zarr.open.v2(this.root_.resolve(attrs.datasetPath), {
      kind: "array",
      attrs: false,
    });

    const dimInfo = await this.getDimInfoMap(region, chunk, attrs);
    if (!dimInfo.has("x") || !dimInfo.has("y")) {
      throw new Error("Missing required spatial axis x/y");
    }

    const chunkCoords: number[] = [];
    dimInfo.forEach((info) => chunkCoords.push(info.chunkIdx));
    const subarray = await array.getChunk(chunkCoords);

    const data = subarray.data;
    if (!isImageChunkData(data)) {
      throw new Error(
        `Subarray has an unsupported data type, data=${data.constructor.name}`
      );
    }

    const sliceSize = chunk.shape.x * chunk.shape.y;
    const zInfo = dimInfo.get("z") ?? dimInfo.get("Z");
    const zOffset = zInfo
      ? sliceSize * (zInfo.value % array.chunks[zInfo.dimIdx])
      : 0;

    chunk.data = data.slice(zOffset, zOffset + sliceSize);
  }

  async loadRegion(
    region: Region,
    lod: number,
    scheduler?: PromiseScheduler
  ): Promise<ImageChunk> {
    if (lod >= this.lods_) {
      throw new Error(
        `Invalid LOD index: ${lod}. Only ${this.lods_} lod(s) available`
      );
    }

    const attributes = this.getImageAttributes()[lod];
    const indices = this.regionToIndices(region, attributes);
    const { datasetPath, scale, translation } = attributes;

    const array = await zarr.open.v2(this.root_.resolve(datasetPath), {
      kind: "array",
      attrs: false,
    });
    let options = {};
    if (scheduler !== undefined) {
      options = {
        create_queue: () => new PromiseQueue(scheduler),
        opts: { signal: scheduler.abortSignal },
      };
    }
    const subarray = await zarr.get(array, indices, options);

    if (!isImageChunkData(subarray.data)) {
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
      if (typeof index === "number" || index.start === null) return 0;
      return index.start * scale[i] + translation[i];
    };
    const xOffset = calculateOffset(indices.length - 1);
    const yOffset = calculateOffset(indices.length - 2);

    const chunk: ImageChunk = {
      state: "loaded",
      lod: lod,
      visible: true,
      data: subarray.data,
      shape: {
        x: subarray.shape[subarray.shape.length - 1],
        y: subarray.shape[subarray.shape.length - 2],
        c: subarray.shape.length === 3 ? subarray.shape[0] : 1,
      },
      chunkIndex: { x: 0, y: 0 },
      rowStride: subarray.stride[subarray.stride.length - 2],
      rowAlignmentBytes: rowAlignment,
      scale: { x: scale[indices.length - 1], y: scale[indices.length - 2] },
      offset: { x: xOffset, y: yOffset },
    };
    return chunk;
  }

  private getImageAttributes(): ImageAttributes[] {
    const output: ImageAttributes[] = [];

    for (let i = 0; i < this.lods_; ++i) {
      const image = this.metadata_.multiscales[0];
      const axes = image.axes;
      const dimensionNames = image.axes.map((axis) => axis.name);
      const dataset = image.datasets[i];
      const datasetPath = dataset.path;
      const scale = dataset.coordinateTransformations[0].scale;
      const translation =
        dataset.coordinateTransformations.length === 2
          ? dataset.coordinateTransformations[1].translation
          : new Array(axes.length).fill(0);

      output.push({ image, dimensionNames, datasetPath, scale, translation });
    }

    return output;
  }

  public async loadAttributes(): Promise<LoaderAttributes[]> {
    return await Promise.all(
      this.getImageAttributes().map(async (attr) => {
        const zarrArray = await zarr.open.v2(
          this.root_.resolve(attr.datasetPath),
          {
            kind: "array",
            attrs: false,
          }
        );
        return {
          chunks: zarrArray.chunks,
          dimensionNames: attr.dimensionNames,
          shape: zarrArray.shape,
          scale: attr.scale,
        };
      })
    );
  }

  private async getDimInfoMap(
    region: Region,
    chunk: ImageChunk,
    attrs: ImageAttributes
  ) {
    const indices = this.regionToIndices(region, attrs);
    const array = await zarr.open.v2(this.root_.resolve(attrs.datasetPath), {
      kind: "array",
      attrs: false,
    });

    const output = new Map();
    region.forEach((entry, dimIdx) => {
      if (entry.dimension.toLowerCase() === "x") {
        const value = 0; // not used for x dimension
        output.set("x", { dimIdx, chunkIdx: chunk.chunkIndex.x, value });
        return;
      }

      if (entry.dimension.toLowerCase() === "y") {
        const value = 0; // not used for y dimension
        output.set("y", { dimIdx, chunkIdx: chunk.chunkIndex.y, value });
        return;
      }

      const value = indices[dimIdx];
      if (typeof value !== "number") {
        throw new Error(`Expected numeric index for ${entry.dimension}`);
      }

      const chunkIdx = Math.floor(value / array.chunks[dimIdx]);
      output.set(entry.dimension, { dimIdx, chunkIdx, value });
    });

    return output;
  }

  private regionToIndices(
    region: Region,
    attributes: ImageAttributes
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
        index = Math.round(translation[i] + regionIndex.value / scale[i]);
      } else {
        index = zarr.slice(
          Math.floor(translation[i] + regionIndex.start / scale[i]),
          Math.ceil(translation[i] + regionIndex.stop / scale[i])
        );
      }
      indices.push(index);
    }
    return indices;
  }
}
