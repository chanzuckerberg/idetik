import { Layer } from "core/layer";
import { Mesh } from "objects/renderable/mesh";
import { PlaneGeometry } from "objects/geometry/plane_geometry";
import { DataTexture2D } from "objects/textures/data_texture_2d";
import { OmeZarrMultiscaleVolumeSource } from "data/ome_zarr_source";

export class OmeZarr2DSliceLayer extends Layer {
  private source_: OmeZarrMultiscaleVolumeSource;
  private plane_ = new PlaneGeometry(3, 3, 1, 1);

  constructor(source: OmeZarrMultiscaleVolumeSource) {
    super();
    this.state_ = "initialized";
    this.source_ = source;
  }

  public update(): void {
    if (this.state === "initialized") {
        // TODO: pass input from renderer through update.
        const input = {region: []};
        this.state_ = "loading";
        this.source_.loadChunks(input).then((chunks) => {
            // TODO: handle mapping multiple chunks to textures.
            const chunk = chunks[0];
            const texture = new DataTexture2D(chunk.data, chunk.shape[0], chunk.shape[1]);
            this.addObject(new Mesh(this.plane_.meshSource, texture));
            this.state_ = "ready";
        });
    }
  }
}
