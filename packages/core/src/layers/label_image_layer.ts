import { Layer, LayerOptions } from "../core/layer";
import { Region } from "../data/region";
import { Chunk, ChunkSource } from "../data/chunk";
import { Texture2D } from "../objects/textures/texture_2d";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";
import {
  LabelColorMap,
  LabelColorMapProps,
} from "../objects/renderable/label_color_map";
import { LabelImageRenderable } from "../objects/renderable/label_image_renderable";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";
import {
  getValueAtWorld,
  handlePointPickingEvent,
  PointPickingResult,
} from "./point_picking";

export type LabelImageLayerProps = LayerOptions & {
  source: ChunkSource;
  region: Region;
  colorMap?: LabelColorMapProps;
  onPickValue?: (info: PointPickingResult) => void;
};

export class LabelImageLayer extends Layer {
  public readonly type = "LabelImageLayer";

  private readonly source_: ChunkSource;
  private readonly region_: Region;
  private readonly lod_?: number;
  private colorMap_: LabelColorMap;
  private readonly onPickValue_?: (info: PointPickingResult) => void;
  private image_?: LabelImageRenderable;
  private imageChunk_?: Chunk;
  private pointerDownPos_: vec2 | null = null;

  constructor({
    source,
    region,
    colorMap = {},
    onPickValue,
    lod,
    ...layerOptions
  }: LabelImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.colorMap_ = new LabelColorMap(colorMap);
    this.onPickValue_ = onPickValue;
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

  public get colorMap(): LabelColorMap {
    return this.colorMap_;
  }

  public setColorMap(colorMap: LabelColorMapProps) {
    this.colorMap_ = new LabelColorMap(colorMap);
    if (this.image_) {
      this.image_.setColorMap(this.colorMap_);
    }
  }

  public onEvent(event: EventContext) {
    this.pointerDownPos_ = handlePointPickingEvent(
      event,
      this.pointerDownPos_,
      (world) => this.getValueAtWorld(world),
      this.onPickValue_
    );
  }

  private async load(region: Region) {
    if (this.state !== "initialized") {
      throw new Error(`Trying to load chunks more than once.`);
    }
    this.setState("loading");
    const loader = await this.source_.open();
    const attributes = loader.getAttributes();
    const lod = this.lod_ ?? attributes.length - 1;
    const chunk = await loader.loadRegion(region, lod);
    this.image_ = this.createImage(chunk);
    this.addObject(this.image_);
    this.setState("ready");
  }

  private createImage(chunk: Chunk) {
    this.imageChunk_ = chunk; // Store chunk for value picking
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);
    const image = new LabelImageRenderable({
      geometry,
      imageData: Texture2D.createWithChunk(chunk),
      colorMap: this.colorMap_,
    });
    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
    return image;
  }

  public getValueAtWorld(world: vec3): number | null {
    const { image_: image, imageChunk_: chunk } = this;
    if (!image || !chunk) {
      return null;
    }
    return getValueAtWorld(world, image.transform, chunk);
  }
}
