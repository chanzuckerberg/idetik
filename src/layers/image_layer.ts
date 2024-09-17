import { Layer } from "core/layer";
import { Mesh } from "objects/renderable/mesh";
import { PlaneGeometry } from "objects/geometry/plane_geometry";
import { Uint16Texture2D } from "objects/textures/uint16_texture_2d";
import { Region } from "data/region";
import { ImageChunk } from "data/image_chunk";

interface ImageLayerSource {
  open(): Promise<ImageChunkLoader>;
}

interface ImageChunkLoader {
  loadChunks(input: Region): Promise<ImageChunk[]>;
}

// Loads data from an image source into renderable objects.
export class ImageLayer extends Layer {
  private source_: ImageLayerSource;
  // TODO: remove this when region is passed through to update.
  // https://github.com/chanzuckerberg/imaging-active-learning/issues/33
  private region_: Region;
  // TODO: plane geometry should be defined by data source extents and region.
  // https://github.com/chanzuckerberg/imaging-active-learning/issues/35
  private plane_ = new PlaneGeometry(3, 3, 1, 1);
  private loader_: ImageChunkLoader | null = null;

  constructor(source: ImageLayerSource, region: Region) {
    super();
    this.state_ = "initialized";
    this.source_ = source;
    this.region_ = region;
  }

  public update(): void {
    switch (this.state) {
      case "initialized":
        this.open();
        break;
      case "opened":
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

  private async open() {
    this.loader_ = await this.source_.open();
    this.state_ = "opened";
  }

  private async load(region: Region) {
    if (this.state_ !== "opened") {
      throw new Error(`Trying to load chunks from unopened source.`);
    }
    this.state_ = "loading";
    // loader_ should be non-null when in opened state.
    const chunks = await this.loader_!.loadChunks(region);
    // TODO: handle mapping many chunks to many textures.
    // https://github.com/chanzuckerberg/imaging-active-learning/issues/34
    if (chunks.length !== 1) {
      throw new Error(`Expected one chunk. Instead found ${chunks.length}`);
    }
    const chunk = chunks[0];
    const texture = new Uint16Texture2D(
      chunk.data,
      chunk.shape.width,
      chunk.shape.height,
      chunk.rowLength
    );
    this.addObject(new Mesh(this.plane_.meshSource, texture));
    this.state_ = "ready";
  }
}
