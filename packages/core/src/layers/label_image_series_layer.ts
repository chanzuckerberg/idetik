import { Layer, LayerProps } from "../core/layer";
import { Region } from "../data/region";
import { Chunk, ChunkSource } from "../data/chunk";
import { Texture2D } from "../objects/textures/texture_2d";
import { LabelImageRenderable } from "../objects/renderable/label_image_renderable";
import {
  LabelColorMap,
  LabelColorMapProps,
} from "../objects/renderable/label_color_map";
import { ImageSeriesLoader, SetIndexResult } from "./image_series_loader";

export type LabelImageSeriesLayerProps = LayerProps & {
  source: ChunkSource;
  region: Region;
  seriesDimensionName: string;
  colorMap?: LabelColorMapProps;
  lod?: number;
};

export class LabelImageSeriesLayer extends Layer {
  public readonly type = "LabelImageSeriesLayer";
  private readonly seriesLoader_: ImageSeriesLoader;
  private colorMap_: LabelColorMap;
  private texture_: Texture2D | null = null;
  private image_?: LabelImageRenderable;
  private extent_?: { x: number; y: number };

  constructor({
    source,
    region,
    seriesDimensionName,
    colorMap = {},
    lod,
    ...layerOptions
  }: LabelImageSeriesLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.colorMap_ = new LabelColorMap(colorMap);
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

  public get colorMap(): LabelColorMap {
    return this.colorMap_;
  }

  public setColorMap(colorMap: LabelColorMapProps) {
    this.colorMap_ = new LabelColorMap(colorMap);
    if (this.image_) {
      this.image_.setColorMap(this.colorMap_);
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
    return this.seriesLoader_.preloadAllChunks();
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

  private setData(chunk: Chunk) {
    if (!this.texture_ || !this.image_) {
      this.texture_ = Texture2D.createWithChunk(chunk);
      this.image_ = this.createImage(chunk, this.texture_);
      this.addObject(this.image_);

      // extent does not change after renderable creation
      this.extent_ = {
        x: chunk.shape.x * chunk.scale.x,
        y: chunk.shape.y * chunk.scale.y,
      };
    } else if (chunk.data) {
      this.texture_.updateWithChunk(chunk);
    }
  }

  private createImage(chunk: Chunk, texture: Texture2D) {
    const image = new LabelImageRenderable({
      width: chunk.shape.x,
      height: chunk.shape.y,
      imageData: texture,
      colorMap: this.colorMap_,
    });
    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
    return image;
  }
}
