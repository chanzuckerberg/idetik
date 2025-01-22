import { Layer } from "core/layer";
import { Region } from "data/region";
import { ImageChunkSource } from "data/image_chunk";
import { makeImageMesh, makeImageTexture } from "layers/image_utils";

// Loads data from an image source into renderable objects.
export class ImageLayer extends Layer {
  private readonly source_: ImageChunkSource;
  // TODO: remove this when region is passed through to update.
  // https://github.com/chanzuckerberg/imaging-active-learning/issues/33
  private readonly region_: Region;
  private readonly contrastLimits_?: [number, number];

  constructor(
    source: ImageChunkSource,
    region: Region,
    contrastLimits?: [number, number]
  ) {
    super();
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.contrastLimits_ = contrastLimits;
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
    const texture = makeImageTexture(chunk);
    const mesh = makeImageMesh(chunk, texture, this.contrastLimits_);
    this.addObject(mesh);
    this.setState("ready");
  }
}
