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

  async loadChunkXYZ(chunk: ImageChunk) {
    console.log(
      `OmeZarrImageLoader.loadChunkXYZ: Loading chunk (${chunk.chunkIndex!.x},${chunk.chunkIndex!.y}) for LOD ${chunk.lod}`
    );

    const attrs = this.getImageAttributes()[chunk.lod];
    console.log(`  - Dataset path for LOD ${chunk.lod}: ${attrs.datasetPath}`);

    const array = await zarr.open.v2(this.root_.resolve(attrs.datasetPath), {
      kind: "array",
      attrs: false,
    });

    console.log(`  - Array shape: [${array.shape.join(", ")}]`);
    console.log(`  - Array chunks: [${array.chunks.join(", ")}]`);

    const chunkCoords = [
      400, // t
      0, // c
      1, // z
      chunk.chunkIndex!.y, // y
      chunk.chunkIndex!.x, // x
    ];
    console.log(
      `  - Requesting chunk coordinates: [${chunkCoords.join(", ")}]`
    );

    const d = await array.getChunk(chunkCoords);
    console.log(`  - Retrieved chunk shape: [${d.shape.join(", ")}]`);
    console.log(`  - Retrieved data length: ${d.data.length}`);

    if (!isImageChunkData(d.data)) {
      throw new Error(
        `Subarray has an unsupported data type, data=${d.data.constructor.name}`
      );
    }

    // Calculate the correct slice based on chunk dimensions
    // The zarr chunk shape is [t, c, z, y, x] = [1, 1, 128, 362, 362]
    // We want z slice 1, so we need to extract the right 2D slice from the 3D data
    const [, , _, yDim, xDim] = d.shape;
    const sliceSize = yDim * xDim; // 362 * 362 = 131044
    const zIndex = 1; // We want z=1
    const sliceStart = zIndex * sliceSize;
    const sliceEnd = sliceStart + sliceSize;

    console.log(
      `  - Calculated slice: z=${zIndex}, slice size=${sliceSize}, range=[${sliceStart}, ${sliceEnd})`
    );

    chunk.data = d.data.subarray(sliceStart, sliceEnd);
    console.log(`  - Final chunk data length: ${chunk.data.length}`);

    // Sample the data and calculate range
    const sample = Array.from(chunk.data.slice(0, 10));
    let minVal = chunk.data[0];
    let maxVal = chunk.data[0];
    let nonZeroCount = 0;
    for (let i = 0; i < chunk.data.length; i++) {
      if (chunk.data[i] < minVal) minVal = chunk.data[i];
      if (chunk.data[i] > maxVal) maxVal = chunk.data[i];
      if (chunk.data[i] !== 0) nonZeroCount++;
    }
    console.log(`  - Data sample: [${sample.join(", ")}...]`);
    console.log(
      `  - Data range: ${minVal} to ${maxVal} (${nonZeroCount}/${chunk.data.length} non-zero values)`
    );

    // Also try different z-slices to see if we're using the right one
    if (chunk.chunkIndex!.x === 0 && chunk.chunkIndex!.y === 0) {
      console.log(`  - Checking other z-slices for comparison:`);
      for (let z = 0; z < 3; z++) {
        const testStart = z * sliceSize;
        const testEnd = testStart + Math.min(1000, sliceSize);
        const testSlice = d.data.subarray(testStart, testEnd);
        let testMin = testSlice[0];
        let testMax = testSlice[0];
        let testNonZero = 0;
        for (let i = 0; i < testSlice.length; i++) {
          if (testSlice[i] < testMin) testMin = testSlice[i];
          if (testSlice[i] > testMax) testMax = testSlice[i];
          if (testSlice[i] !== 0) testNonZero++;
        }
        console.log(
          `    z=${z}: range ${testMin}-${testMax}, ${testNonZero}/${testSlice.length} non-zero`
        );
      }
    }
  }

  async loadChunk(
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
