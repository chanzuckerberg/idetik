import { Layer } from "core/layer";
import { Mesh } from "objects/renderable/mesh";
import { PlaneGeometry } from "objects/geometry/plane_geometry";
import { Region } from "data/region";
import { ImageChunkSource } from "data/image_chunk";
import { DataTexture2D } from "objects/textures/data_texture_2d";

// Loads data from an image source into renderable objects.
export class ImageLayer extends Layer {
  private readonly source_: ImageChunkSource;
  // TODO: remove this when region is passed through to update.
  // https://github.com/chanzuckerberg/imaging-active-learning/issues/33
  private readonly region_: Region;

  constructor(source: ImageChunkSource, region: Region) {
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
    const shape = chunk.shape;
    const texture = new DataTexture2D(chunk.data, shape.x, shape.y);
    const plane = new PlaneGeometry(shape.x, shape.y, 1, 1);

    texture.dataFormat = "red_integer";
    if (chunk.data instanceof Uint16Array) {
      texture.dataType = "unsigned_short";
    }

    texture.unpackRowLength = chunk.rowStride;
    texture.unpackAlignment = chunk.rowAlignmentBytes;

    const mesh = new Mesh(plane, texture);
    mesh.transform.scale([chunk.scale.x, chunk.scale.y, 1]);
    mesh.transform.translate([chunk.offset.x, chunk.offset.y, 0]);
    this.addObject(mesh);
    this.setState("ready");
  }
}
