import * as zarr from "zarrita";
import { Slice as ZarrSlice } from "@zarrita/indexing";

import { DataLoadInput, VolumeChunk } from "data/region";

interface IdentityTransform {
  type: "identity";
};

interface TranslationTransform {
  type: "translation";
  translation: Array<number>;
};

interface ScaleTransform {
  type: "scale";
  scale: Array<number>;
};

type Transform = IdentityTransform | TranslationTransform | ScaleTransform;

interface Dataset {
  path: string;
  coordinateTransformations: Array<Transform>;
};

interface Axis {
  name: string;
  type?: string;
};

interface Multiscale {
  axes: Array<Axis>;
  datasets: Array<Dataset>;
};

export class OmeZarrMultiscaleVolumeSource {
  root: zarr.Group<zarr.FetchStore>;
  axes: Array<Axis>;
  datasets: Array<Dataset>;

  constructor(root: zarr.Group<zarr.FetchStore>) {
    this.root = root;
    const multiscales = this.root.attrs.multiscales as Array<Multiscale>;
    if (multiscales.length !== 1) {
      throw new Error(
        `Can only handle one multiscale image. Found ${multiscales.length}`
      );
    }
    const image = multiscales[0];
    this.axes = image.axes;
    this.datasets = image.datasets;
  }

  static async open(url: string): Promise<OmeZarrMultiscaleVolumeSource> {
    const store = new zarr.FetchStore(url);
    const root = await zarr.open.v2(store, { kind: "group" });
    console.debug("opened root:", root, root.attrs);
    return new OmeZarrMultiscaleVolumeSource(root);
  }

  async loadChunks(input: DataLoadInput): Promise<VolumeChunk<Uint16Array>[]> {
    // TODO: use the input to determine what level to load.
    // For now, just use the lowest.
    const datasetIndex = this.datasets.length - 1;
    const dataset = this.datasets[datasetIndex];
    console.debug("loading dataset ", dataset);

    const indices: Array<ZarrSlice | number | null> = [];
    for (const [i, axis] of this.axes.entries()) {
      let index = null;
      const match = input.region.find((s) => s.dimension == axis.name);
      if (match) {
        // TODO: handle more than just scale to transform input region.
        const scale = dataset.coordinateTransformations
          .map((tfm) => tfm.type === "scale" ? tfm.scale[i] : 1)
          .reduce((totalScale, scale) => scale * totalScale, 1);
        if (match.stop === undefined) {
          index = Math.round(match.start / scale);
        } else {
          index = zarr.slice(
            Math.floor(match.start / scale),
            Math.ceil(match.stop / scale)
          );
        }
      }
      indices.push(index);
    }
    console.debug("loading chunk at ", indices);

    const array = await zarr.open.v2(this.root.resolve(dataset.path), {
      kind: "array",
      attrs: false,
    });

    const subarray = await zarr.get(array, indices);
    const chunk = {
      data: subarray.data as Uint16Array,
      shape: subarray.shape,
      stride: subarray.stride,
      region: input.region,
    };
    console.debug("loaded chunk: ", chunk);
    return [chunk];
  }
}
