import * as zarr from "zarrita";
import { Group, Location, open as openZarr } from "@zarrita/core";
import FetchStore from "@zarrita/storage/fetch";
import { Readable } from "@zarrita/storage";
import { Slice } from "@zarrita/indexing";
import { Dimension, DimensionMapping, DimensionMappingProps, VirtualCamera2D } from "./dimensions";
import { Image as OmeZarrImage } from "../data/ome_ngff/0.4/image";
import { parseOmeNgffImage } from "../data/ome_zarr_hcs_metadata_loader";

type OmeZarrChunkSourceProps = {
  group: Group<Readable>;
  dimensions: DimensionMapping;
};

export class OmeZarrChunkSource {
  private readonly group_: Group<Readable>;
  private readonly metadata_: OmeZarrImage["multiscales"];
  private readonly dimensions_: DimensionMapping;

  private constructor(props: OmeZarrChunkSourceProps) {
    this.group_ = props.group;
    this.metadata_ = parseOmeNgffImage(this.group_).multiscales;
    this.dimensions_ = props.dimensions;
  }

  public get dimensions() {
    return this.dimensions_;
  }

  public async loadChunk(camera: VirtualCamera2D) {
    const lod = camera.lod ?? 0;
    const array = await openZarr.v2(
      this.group_.resolve(this.metadata_[0].datasets[lod].path),
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

  public async loadChunks(camera: VirtualCamera2D) {
    const lod = camera.lod ?? 0;
    const array = await openZarr.v2(
      this.group_.resolve(this.metadata_[0].datasets[lod].path),
      { kind: "array", attrs: false }
    );
    const indices = this.getChunkIndices(camera); 
    const promises = indices.map((idx) => array.getChunk(idx));
    return await Promise.all(promises);
  }

  private getChunkIndices(_camera: VirtualCamera2D): number[][] {
    // TODO: get chunk indices.
    return [];
  }

  private getArrayIndices(camera: VirtualCamera2D): Array<Slice | number> {
    const numDimensions = Object.keys(this.dimensions_).length;
    const indices: Array<Slice | number> = new Array(numDimensions).fill(zarr.slice(null));
    
    // TODO: store translation and scale for each dimension and lod on construction.
    const xTranslation = 0;
    const xScale = 1;
    const xStart = Math.floor((camera.x.start - xTranslation) / xScale);
    const xEnd = Math.ceil((camera.x.end - xTranslation) / xScale);
    const xIndex = zarr.slice(xStart, xEnd);
    indices[this.dimensions_.x.index] = xIndex;

    const yTranslation = 0;
    const yScale = 1;
    const yStart = Math.floor((camera.y.start - yTranslation) / yScale);
    const yEnd = Math.ceil((camera.y.end - yTranslation) / yScale);
    const yIndex = zarr.slice(yStart, yEnd);
    indices[this.dimensions_.y.index] = yIndex;

    if (camera.z) {
        const zTranslation = 0;
        const zScale = 1;
        const zIndex = Math.round((camera.z - zTranslation) / zScale);
        indices[this.dimensions_.z!.index] = zIndex;
    }

    if (camera.c) {
        indices[this.dimensions_.c!.index] = camera.c;
    }

    if (camera.t) {
        const tTranslation = 0;
        const tScale = 1;
        const tIndex = Math.round((camera.t - tTranslation) / tScale);
        indices[this.dimensions_.t!.index] = tIndex;
    }

    return indices;
  }

  public static async fromUrl(url: string, dimensionProps: DimensionMappingProps): Promise<OmeZarrChunkSource> {
    const store = new FetchStore(url);
    const group = await openZarr.v2(new Location(store), { kind: "group" });
    const metadata = parseOmeNgffImage(group).multiscales;
    const image = metadata[0];
    const dataset = image.datasets[0];
    const axes = image.axes;
    const array = await openZarr.v2(group.resolve(dataset.path), { kind: "array", attrs: false });
    const shape = array.shape;
    if (axes.length !== shape.length) {
        throw new Error(`Mismatch between number of axes (${axes.length}) and array shape (${array.shape.length})`);
    }

    const x = findDimension(axes, shape, dimensionProps.x.name);
    if (x.index !== axes.length - 1) {
      throw new Error(`X axis must be the last axis in the data.
        Found at index ${x.index} of ${axes.length}`);
    }

    const y = findDimension(axes, shape, dimensionProps.y.name);
    if (y.index !== axes.length - 2) {
      throw new Error(`Y axis must be the second to last axis in the data.
        Found at index ${y.index} of ${axes.length}`);
    }

    let z;
    if (dimensionProps.z) {
      z = findDimension(axes, shape, dimensionProps.z.name);
      if (z.index !== axes.length - 3) {
        throw new Error(`Z axis must be the third to last axis in the data.
          Found at index ${z.index} of ${axes.length}`);
      }
    }

    let t;
    if (dimensionProps.t) {
      t = findDimension(axes, shape, dimensionProps.t.name);
      if (t.index !== 0) {
        throw new Error(`T axis must be the first axis in the data.
          Found at index ${t.index} of ${axes.length}`);
      }
    }

    let c;
    if (dimensionProps.c) {
      c = findDimension(axes, shape, dimensionProps.c.name);
      if (t && c.index !== 1) {
        throw new Error(`When T is present C axis must be the second axis in the data.
          Found at index ${c.index} of ${axes.length}`);
      }
      if (!t && c.index !== 0) {
        throw new Error(`When T is not present C axis must be the first axis in the data.
          Found at index ${c.index} of ${axes.length}`);
      }
    }

    const dimensions = {x, y, z, c, t};
    return new OmeZarrChunkSource({group, dimensions});
  }
}

function findDimension(
  axes: OmeZarrImage["multiscales"][number]["axes"],
  shape: number[],
  name: string,
): Dimension {
  const index = axes.findIndex((a) => a.name === name);
  if (index === -1) {
    throw new Error(`Could not find axis named "${name}"`);
  }
  return {
    name,
    index,
    length: shape[index],
    unit: axes[index].unit,
  };
}
