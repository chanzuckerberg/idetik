import { Layer } from "core/layer";
import { Mesh } from "objects/renderable/mesh";
import { PlaneGeometry } from "objects/geometry/plane_geometry";
import { DataTexture2D } from "objects/textures/data_texture_2d";
import { Region } from "data/region";
import { ImageChunk } from "data/image_chunk";

interface ImageLayerSource {
  open(): Promise<ImageChunkLoader>;
}

// TODO: support dtypes other than uint16.
interface ImageChunkLoader {
  loadChunks(input: Region): Promise<ImageChunk<Uint16Array>[]>;
}

export class ImageLayer extends Layer {
  private source_: ImageLayerSource;
  private loader_: ImageChunkLoader | null = null;
  // TODO: remove this when region is passed through to update.
  private region_: Region;
  // TODO: plane geometry should be defined by data source extents and region.
  private plane_ = new PlaneGeometry(3, 3, 1, 1);

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
    }
  }

  private async open() {
    this.loader_ = await this.source_.open();
    this.state_ = "opened";
  }

  private async load(region: Region) {
    if (this.loader_ === null) {
      throw new Error(`Trying to load chunks from unopened source.`);
    }
    this.state_ = "loading";
    const chunks = await this.loader_.loadChunks(region);
    // TODO: handle mapping many chunks to many textures.
    if (chunks.length !== 1) {
      throw new Error(`Expected one chunk. Instead found ${chunks.length}`);
    }
    const chunk = chunks[0];
    if (chunk.shape.length !== 2) {
      throw new Error(
        `Expected a 2D chunk. Instead chunk has shape ${chunk.shape}`
      );
    }
    const [height, width] = chunk.shape;
    const texture = new DataTexture2D(chunk.data, width, height);
    this.addObject(new Mesh(this.plane_.meshSource, texture));
    this.state_ = "ready";
  }
}
