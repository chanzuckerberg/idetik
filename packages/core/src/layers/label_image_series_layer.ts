import { Layer, LayerOptions } from "../core/layer";
import { Region } from "../data/region";
import { ImageChunk, ImageChunkSource } from "../data/image_chunk";
import { Texture2D } from "../objects/textures/texture_2d";
import { LabelImageRenderable } from "../objects/renderable/label_image_renderable";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";
import { LabelColorMap } from "../objects/renderable/label_color_map";
import { ImageSeriesLoader, SetIndexResult } from "./image_series_loader";

export type LabelImageSeriesLayerProps = LayerOptions & {
  source: ImageChunkSource;
  region: Region;
  seriesDimensionName: string;
  colorMap?: LabelColorMap;
};

export class LabelImageSeriesLayer extends Layer {
  public readonly type = "LabelImageSeriesLayer";
  private readonly seriesLoader_: ImageSeriesLoader;
  private readonly colorMap_: LabelColorMap;
  private texture_: Texture2D | null = null;
  private image_?: LabelImageRenderable;
  private extent_?: { x: number; y: number };

  constructor({
    source,
    region,
    seriesDimensionName,
    colorMap = new LabelColorMap(),
    lod,
    ...layerOptions
  }: LabelImageSeriesLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.colorMap_ = colorMap;
    this.seriesLoader_ = new ImageSeriesLoader({
      source,
      region,
      seriesDimensionName,
      lod,
    });
  }

  public update() {
    if (this.state === "initialized") {
      this.setState("loading");
      this.seriesLoader_.loadSeriesAttributes();
    }
  }

  public async setPosition(position: number): Promise<SetIndexResult> {
    const result = await this.seriesLoader_.setPosition(position);
    return this.processIndexResult(result);
  }

  public async setIndex(index: number): Promise<SetIndexResult> {
    const result = await this.seriesLoader_.setIndex(index);
    return this.processIndexResult(result);
  }

  public close() {
    this.seriesLoader_.shutdown();
  }

  public async preloadSeries() {
    this.seriesLoader_.preloadSeries();
  }

  public get extent(): { x: number; y: number } | undefined {
    return this.extent_;
  }

  private processIndexResult(result: SetIndexResult) {
    if (result.chunk) {
      this.setData(result.chunk);
      this.setState("ready");
    }
    return result;
  }

  private setData(chunk: ImageChunk) {
    if (!this.texture_ || !this.image_) {
      this.texture_ = Texture2D.createWithImageChunk(chunk);
      this.image_ = this.createImage(chunk, this.texture_);
      this.addObject(this.image_);

      // extent does not change after renderable creation
      this.extent_ = {
        x: chunk.shape.x * chunk.scale.x,
        y: chunk.shape.y * chunk.scale.y,
      };
    } else if (chunk.data) {
      this.texture_.data = chunk.data;
    }
  }

  private createImage(chunk: ImageChunk, texture: Texture2D) {
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);
    const image = new LabelImageRenderable({
      geometry,
      imageData: texture,
      colorMap: this.colorMap_,
    });
    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
    return image;
  }
}
