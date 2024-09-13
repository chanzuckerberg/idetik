import * as zarr from "zarrita";
import { Slice } from "@zarrita/indexing";

import { Region } from "data/region";
import { ImageChunk } from "data/image_chunk";

interface IdentityTransform {
  type: "identity";
}

interface TranslationTransform {
  type: "translation";
  translation: Array<number>;
}

interface ScaleTransform {
  type: "scale";
  scale: Array<number>;
}

type Transform = IdentityTransform | TranslationTransform | ScaleTransform;

interface Dataset {
  path: string;
  coordinateTransformations: Array<Transform>;
}

interface Axis {
  name: string;
  type?: string;
}

interface Multiscale {
  axes: Array<Axis>;
  datasets: Array<Dataset>;
}

// A multiscale image from a Zarr implementation of OME-NGFF v0.4:
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

  async loadChunks(region: Region): Promise<ImageChunk[]> {
    // TODO: use the input to determine what level to load.
    const lowestResolutionIndex = this.datasets_.length - 1;
    const dataset = this.datasets_[lowestResolutionIndex];
    const indices = regionToIndices(region, dataset, this.axes_);
    console.debug("loading dataset with indices", dataset, indices);

    const array = await zarr.open.v2(this.root_.resolve(dataset.path), {
      kind: "array",
      attrs: false,
    });
    console.debug("opened array ", array);

    if (array.dtype !== "uint16") {
      throw new Error(
        `Only uint16 image data is supported. Instead array has dtype ${array.dtype}`
      );
    }

    const subarray = await zarr.get(array, indices);
    if (subarray.shape.length !== 2) {
      throw new Error(
        `Expected to receive a 2D subarray. Instead chunk has shape ${subarray.shape}`
      );
    }

    if (subarray.stride[1] !== 1) {
      throw new Error(
        `Expected to receive packed rows. Instead found a column stride of ${subarray.stride[1]}`
      );
    }

    const chunk = {
      data: subarray.data as Uint16Array,
      shape: { width: subarray.shape[1], height: subarray.shape[0] },
      rowLength: subarray.stride[0],
    };
    console.debug("loaded chunk ", chunk);
    return [chunk];
  }
}

// Converts a region to indices within an OME-Zarr image array.
function regionToIndices(
  region: Region,
  dataset: Dataset,
  axes: Array<Axis>
): Array<Slice | number> {
  const indices: Array<Slice | number> = [];
  for (const [i, axis] of axes.entries()) {
    const match = region.find((s) => s.dimension == axis.name);
    // If a match was not found use a null slice which represents
    // the complete extent of a dimension like Python's `slice(None)`.
    let index: Slice | number = zarr.slice(null);
    if (match) {
      // TODO: handle more than just scale list to transform input region.
      const scale = dataset.coordinateTransformations
        .map((transform) => transformScale(transform, i))
        .reduce((totalScale, scale) => scale * totalScale, 1);
      const regionIndex = match.index;
      if (typeof regionIndex === "number") {
        index = Math.round(regionIndex / scale);
      } else {
        index = zarr.slice(
          Math.floor(regionIndex.start / scale),
          Math.ceil(regionIndex.stop / scale)
        );
      }
    }
    indices.push(index);
  }
  return indices;
}

// Returns a scale from a transform at some axis index or 1 if a scale cannot be found.
function transformScale(transform: Transform, index: number): number {
  if (transform.type !== "scale") return 1;
  if (!(transform.scale instanceof Array)) return 1;
  return transform.scale[index];
}
