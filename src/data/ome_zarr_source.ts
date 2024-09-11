import * as zarr from "zarrita";

import { DataLoadInput, VolumeChunk } from "data/region";
import { MeshSource } from "./mesh_source";
import { PlaneGeometry } from "objects/geometry/plane_geometry";

export class OmeZarrMultiscaleVolumeSource {

  root: zarr.Group<zarr.FetchStore>;
  meshSource: MeshSource;

  constructor(root: zarr.Group<zarr.FetchStore>, meshSource: MeshSource) {
    this.root = root;
    this.meshSource = meshSource;
  }

  static async open(url: string): Promise<OmeZarrMultiscaleVolumeSource> {
    const store = new zarr.FetchStore(url);
    const root = await zarr.open.v2(store, { kind: "group" });
    console.debug("opened root: ", root);
    // TODO: size of plane should be related to physical extent of image.
    const plane = new PlaneGeometry(5, 5, 1, 1);
    const meshSource = plane.meshSource;
    return new OmeZarrMultiscaleVolumeSource(root, meshSource);
  }

  async loadChunks(input: DataLoadInput): Promise<VolumeChunk<Uint16Array>[]> {
    // TODO: use the input to determine what level and what region to load.
    // For now, just load some low-res slice (of shape 544x606 with u16 dtype).
    const array = await zarr.open.v2(this.root.resolve("2"), { kind: "array" , attrs: false });
    const region = await zarr.get(array, [0, 0, 56, null, null]);
    const chunk = {
        data: region.data as Uint16Array,
        shape: region.shape,
        stride: region.stride,
        region: input.region,
    };
    console.debug("loaded chunk: ", chunk);
    return [chunk];
  }
}
