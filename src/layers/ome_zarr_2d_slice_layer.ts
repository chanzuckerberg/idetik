import { Layer } from "core/layer";
import { Mesh } from "objects/renderable/mesh";
import { PlaneGeometry } from "objects/geometry/plane_geometry";
import { DataTexture2D } from "objects/textures/data_texture_2d";
import { OmeZarrMultiscaleVolumeSource } from "data/ome_zarr_source";
import { Region } from "data/region";

export class OmeZarr2DSliceLayer extends Layer {
  private source_: OmeZarrMultiscaleVolumeSource;
  // TODO: remove this when region is passed through to update.
  private region_: Region;
  private plane_ = new PlaneGeometry(3, 3, 1, 1);

  constructor(source: OmeZarrMultiscaleVolumeSource, region: Region) {
    super();
    this.state_ = "initialized";
    this.source_ = source;
    this.region_ = region;
  }

  public update(): void {
    if (this.state === "initialized") {
      const input = { region: this.region_ };
      this.state_ = "loading";
      this.source_.loadChunks(input).then((chunks) => {
        // TODO: handle mapping many chunks to many textures.
        const chunk = chunks[0];
        const [height, width] = chunk.shape;
        const texture = new DataTexture2D(chunk.data, width, height);
        this.addObject(new Mesh(this.plane_.meshSource, texture));
        this.state_ = "ready";
      });
    }
  }
}
