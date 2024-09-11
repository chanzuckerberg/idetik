import * as zarr from "zarrita";

import { DataLoadInput, VolumeChunk } from "data/region";

export class OmeZarrMultiscaleVolumeSource {
  root: zarr.Group<zarr.FetchStore>;

  constructor(root: zarr.Group<zarr.FetchStore>) {
    this.root = root;
  }

  static async open(url: string): Promise<OmeZarrMultiscaleVolumeSource> {
    const store = new zarr.FetchStore(url);
    const root = await zarr.open.v2(store, { kind: "group" });
    console.debug("opened root: ", root);
    return new OmeZarrMultiscaleVolumeSource(root);
  }

  async loadChunks(input: DataLoadInput): Promise<VolumeChunk<Uint16Array>[]> {
    // TODO: use the input to determine what level and what region to load.
    // For now, just load some low-res slice (of shape 544x606 with u16 dtype).
    const array = await zarr.open.v2(this.root.resolve("2"), {
      kind: "array",
      attrs: false,
    });
    const subarray = await zarr.get(array, [0, 0, 56, null, null]);
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
