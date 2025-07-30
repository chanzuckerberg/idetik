import { Layer, LayerOptions } from "../core/layer";
import { Region } from "../data/region";
import { ImageChunk, ImageChunkSource } from "../data/image_chunk";
import { Texture2D } from "../objects/textures/texture_2d";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";
import { LabelColorMap } from "../objects/renderable/label_color_map";
import { LabelImageRenderable } from "../objects/renderable/label_image_renderable";
import { EventContext } from "../core/event_dispatcher";

export type LabelImageLayerProps = LayerOptions & {
  source: ImageChunkSource;
  region: Region;
  colorMap?: LabelColorMap;
};

export class LabelImageLayer extends Layer {
  public readonly type = "LabelImageLayer";

  private readonly source_: ImageChunkSource;
  private readonly region_: Region;
  private readonly lod_?: number;
  private readonly colorMap_: LabelColorMap;
  private image_?: LabelImageRenderable;

  constructor({
    source,
    region,
    colorMap = new LabelColorMap(),
    lod,
    ...layerOptions
  }: LabelImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.colorMap_ = colorMap;
    this.lod_ = lod;
  }

  public update() {
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

  public onEvent(_: EventContext) {
    // TODO: implement segment selection
  }

  private async load(region: Region) {
    if (this.state !== "initialized") {
      throw new Error(`Trying to load chunks more than once.`);
    }
    this.setState("loading");
    const loader = await this.source_.open();
    const attributes = await loader.loadAttributes();
    const lod = this.lod_ ?? attributes.length - 1;
    const chunk = await loader.loadRegion(region, lod);
    this.image_ = this.createImage(chunk);
    this.addObject(this.image_);
    this.setState("ready");
  }

  private createImage(chunk: ImageChunk) {
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);
    const image = new LabelImageRenderable({
      geometry,
      imageData: Texture2D.createWithImageChunk(chunk),
      colorMap: this.colorMap_,
    });
    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
    return image;
  }
}
