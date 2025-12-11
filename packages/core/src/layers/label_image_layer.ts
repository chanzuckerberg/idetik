import { Layer, LayerOptions } from "../core/layer";
import { Region } from "../data/region";
import { Chunk, ChunkSource } from "../data/chunk";
import { Texture2D } from "../objects/textures/texture_2d";
import {
  LabelColorMap,
  LabelColorMapProps,
} from "../objects/renderable/label_color_map";
import { LabelImageRenderable } from "../objects/renderable/label_image_renderable";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";
import { handlePointPickingEvent, PointPickingResult } from "./point_picking";

export type LabelImageLayerProps = LayerOptions & {
  source: ChunkSource;
  region: Region;
  colorMap?: LabelColorMapProps;
  onPickValue?: (info: PointPickingResult) => void;
  lod?: number;
  outlineSelected?: boolean;
};

export class LabelImageLayer extends Layer {
  public readonly type = "LabelImageLayer";

  private readonly source_: ChunkSource;
  private readonly region_: Region;
  private readonly lod_?: number;
  private colorMap_: LabelColorMap;
  private readonly onPickValue_?: (info: PointPickingResult) => void;
  private readonly outlineSelected_: boolean;
  private image_?: LabelImageRenderable;
  private imageChunk_?: Chunk;
  private pointerDownPos_: vec2 | null = null;
  private selectedValue_: number | null = null;

  constructor({
    source,
    region,
    colorMap = {},
    onPickValue,
    lod,
    outlineSelected = false,
    ...layerOptions
  }: LabelImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.colorMap_ = new LabelColorMap(colorMap);
    this.onPickValue_ = onPickValue;
    this.lod_ = lod;
    this.outlineSelected_ = outlineSelected;
  }

  public update() {
    switch (this.state) {
      case "initialized":
        void this.load(this.region_);
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

  public setSelectedValue(value: number | null) {
    this.selectedValue_ = value;
    if (this.image_) {
      this.image_.setSelectedValue(this.selectedValue_);
    }
  }

  public onEvent(event: EventContext) {
    this.pointerDownPos_ = handlePointPickingEvent(
      event,
      this.pointerDownPos_,
      (world) => this.getValueAtWorld(world),
      this.outlineSelected_
        ? (info: PointPickingResult) => {
            this.setSelectedValue(info.value);
            this.onPickValue_?.(info);
          }
        : this.onPickValue_
    );
  }

  private async load(region: Region) {
    if (this.state !== "initialized") {
      throw new Error(`Trying to load chunks more than once.`);
    }
    this.setState("loading");
    const loader = await this.source_.open();
    const lod = this.lod_ ?? loader.getSourceDimensionMap().numLods - 1;
    const chunk = await loader.loadRegion(region, lod);
    this.image_ = this.createImage(chunk);
    this.addObject(this.image_);
    this.setState("ready");
  }

  private createImage(chunk: Chunk) {
    this.imageChunk_ = chunk; // Store chunk for value picking
    const image = new LabelImageRenderable({
      width: chunk.shape.x,
      height: chunk.shape.y,
      imageData: Texture2D.createWithChunk(chunk),
      colorMap: this.colorMap_,
      outlineSelected: this.outlineSelected_,
      selectedValue: this.selectedValue_,
    });
    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
    return image;
  }

  public getValueAtWorld(world: vec3): number | null {
    if (!this.image_ || !this.imageChunk_?.data) {
      return null;
    }

    // Transform world to local texture coordinates using inverse transform
    const localPos = vec3.transformMat4(
      vec3.create(),
      world,
      this.image_.transform.inverse
    );

    // Convert to pixel coordinates and bounds check
    const x = Math.floor(localPos[0]);
    const y = Math.floor(localPos[1]);
    if (
      x < 0 ||
      x >= this.imageChunk_.shape.x ||
      y < 0 ||
      y >= this.imageChunk_.shape.y
    ) {
      return null;
    }

    const pixelIndex = y * this.imageChunk_.shape.x + x;
    const data = this.imageChunk_.data;
    return data[pixelIndex];
  }
}
