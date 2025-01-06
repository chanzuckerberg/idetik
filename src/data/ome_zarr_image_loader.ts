import * as zarr from "zarrita";
import { Slice } from "@zarrita/indexing";

import { Region } from "data/region";
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
    const lowestResolutionIndex = 1;//this.datasets_.length - 1;
    const dataset = this.datasets_[lowestResolutionIndex];
    const indices = regionToIndices(region, dataset, this.axes_);
    console.debug("loading dataset with indices", dataset, indices);

    const array = await zarr.open.v2(this.root_.resolve(dataset.path), {
      kind: "array",
      attrs: false,
    });
    console.debug("opened array ", array);

    const subarray = await zarr.get(array, indices);

    if (!isDataType(subarray.data)) {
      throw new Error(
        `Subarray has an unsupported data type ${subarray.data.constructor.name}. Supported data types are ${dataTypeNames}.`
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

    const chunk = {
      data: subarray.data,
      shape: {
        width: subarray.shape[subarray.shape.length - 1],
        height: subarray.shape[subarray.shape.length - 2],
        channels: subarray.shape.length === 3 ? subarray.shape[0] : 1,
      },
      rowStride: subarray.stride[subarray.stride.length - 2],
      rowAlignmentBytes: rowAlignment,
    };
    console.debug("loaded chunk ", chunk);
    return chunk;
  }
}

// Loads chunks from a HCS zarr image implementing OME-NGFF v0.4:
// https://ngff.openmicroscopy.org/0.4/#hcs-layout

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
      // https://github.com/chanzuckerberg/imaging-active-learning/issues/38
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
