import * as zarr from "zarrita";
import { Slice } from "@zarrita/indexing";

import { DataLoadInput, Interval, Region, ImageChunk } from "data/region";

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
export class OmeZarrMultiscaleImageSource {
  root_: zarr.Group<zarr.FetchStore>;
  axes_: Array<Axis>;
  datasets_: Array<Dataset>;

  constructor(root: zarr.Group<zarr.FetchStore>) {
    this.root_ = root;
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

  // Opens an OME-Zarr multiscale image from the URL of its Zarr group.
  static async open(url: string): Promise<OmeZarrMultiscaleImageSource> {
    const store = new zarr.FetchStore(url);
    const root = await zarr.open.v2(store, { kind: "group" });
    console.debug("opened root ", root, root.attrs);
    return new OmeZarrMultiscaleImageSource(root);
  }

  async loadChunks(input: DataLoadInput): Promise<ImageChunk<Uint16Array>[]> {
    // TODO: use the input to determine what level to load.
    // For now, just use the lowest.
    const datasetIndex = this.datasets_.length - 1;
    const dataset = this.datasets_[datasetIndex];
    const indices = regionToIndices(input.region, dataset, this.axes_);
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
    const chunk = {
      data: subarray.data as Uint16Array,
      shape: subarray.shape,
      stride: subarray.stride,
      region: input.region,
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
): Array<Slice | number | null> {
  const indices: Array<Slice | number | null> = [];
  for (const [i, axis] of axes.entries()) {
    let index = null;
    const regionIndex = region.find((s) => s.dimension == axis.name);
    if (regionIndex) {
      // TODO: handle more than just scale list to transform input region.
      const scale = dataset.coordinateTransformations
        .map((transform) => transformScale(transform, i))
        .reduce((totalScale, scale) => scale * totalScale, 1);
      if (regionIndex.index instanceof Interval) {
        index = zarr.slice(
          Math.floor(regionIndex.index.start / scale),
          Math.ceil(regionIndex.index.stop / scale)
        );
      } else {
        index = Math.round(regionIndex.index / scale);
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
