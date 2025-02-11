import { Layer } from "core/layer";
import { Region } from "data/region";
import { ImageChunkSource } from "data/image_chunk";
import { makeImageMesh, makeImageTextureArray } from "layers/image_utils";

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
    const texture = makeImageTextureArray(chunk);
    const mesh = makeImageMesh(chunk, texture);
    this.addObject(mesh);
    this.setState("ready");
  }
}
