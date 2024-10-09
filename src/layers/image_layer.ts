import { Layer } from "core/layer";
import { Mesh } from "objects/renderable/mesh";
import { PlaneGeometry } from "objects/geometry/plane_geometry";
import { Region } from "data/region";
import { ImageChunk } from "data/image_chunk";
import { DataTexture2D } from "objects/textures/data_texture_2d";

type ImageLayerSource = {
  open(): Promise<ImageChunkLoader>;
};

type ImageChunkLoader = {
  loadChunk(input: Region): Promise<ImageChunk>;
};

// Loads data from an image source into renderable objects.
export class ImageLayer extends Layer {
  private readonly source_: ImageLayerSource;
  // TODO: remove this when region is passed through to update.
  // https://github.com/chanzuckerberg/imaging-active-learning/issues/33
  private readonly region_: Region;
  // TODO: plane geometry should be defined by data source extents and region.
  // https://github.com/chanzuckerberg/imaging-active-learning/issues/35
  private readonly plane_ = new PlaneGeometry(3, 3, 1, 1);

  constructor(source: ImageLayerSource, region: Region) {
    super();
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
  }

  public update(): void {
    switch (this.state) {
      case "initialized":
        this.load(this.region_);
        break;
      case "loading":
      case "ready":
        break;
      default: {
        const exhaustiveCheck: never = this.state;
        throw new Error(`Unhandled LayerState case: ${exhaustiveCheck}`);
      }
    }
  }

  private async load(region: Region) {
    if (this.state !== "initialized") {
      throw new Error(`Trying to load chunks more than once.`);
    }
    this.setState("loading");
    const loader = await this.source_.open();
    const chunk = await loader.loadChunk(region);
    const texture = new DataTexture2D(
      chunk.data,
      chunk.shape.width,
      chunk.shape.height,
      chunk.rowStride,
      chunk.rowAlignmentBytes
    );
    this.addObject(new Mesh(this.plane_, texture));
    this.setState("ready");
  }
}
