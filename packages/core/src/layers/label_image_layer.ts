import { Layer, LayerOptions } from "../core/layer";
import { Region } from "../data/region";
import { ImageChunk, ImageChunkSource } from "../data/image_chunk";
import { Texture2D } from "../objects/textures/texture_2d";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";
import { LabelColorMap } from "../objects/renderable/label_color_map";
import { LabelImageRenderable } from "../objects/renderable/label_image_renderable";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";

export interface PointPickingResult {
  world: vec3;
  value: unknown | null;
}

export type LabelImageLayerProps = LayerOptions & {
  source: ImageChunkSource;
  region: Region;
  colorMap?: LabelColorMap;
  onPickValue?: (info: PointPickingResult) => void;
};

export class LabelImageLayer extends Layer {
  public readonly type = "LabelImageLayer";

  private readonly source_: ImageChunkSource;
  private readonly region_: Region;
  private readonly lod_?: number;
  private readonly colorMap_: LabelColorMap;
  private readonly onPickValue_?: (info: PointPickingResult) => void;
  private image_?: LabelImageRenderable;
  private pointerDownPos_: vec2 | null = null;
  private readonly dragThreshold_ = 3;

  constructor({
    source,
    region,
    colorMap = new LabelColorMap(),
    onPickValue,
    lod,
    ...layerOptions
  }: LabelImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.colorMap_ = colorMap;
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

  public onEvent(event: EventContext) {
    if (!this.onPickValue_) return;

    switch (event.type) {
      case "pointerdown": {
        const e = event.event as PointerEvent;
        this.pointerDownPos_ = vec2.fromValues(e.clientX, e.clientY);
        break;
      }

      case "pointerup": {
        if (!this.pointerDownPos_) break;

        const e = event.event as PointerEvent;
        const pointerUpPos = vec2.fromValues(e.clientX, e.clientY);
        const dist = vec2.distance(this.pointerDownPos_, pointerUpPos);

        if (dist < this.dragThreshold_) {
          this.pointerDownPos_ = null;
          const world = event.worldPos;
          if (!world) return;
          const value = this.getValueAtWorld(world);

          if (value !== null) {
            this.onPickValue_({ world, value });
            event.stopPropagation();
          }
        }
        break;
      }

      case "pointercancel": {
        this.pointerDownPos_ = null;
        break;
      }
    }
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

  public getValueAtWorld(world: vec3): vec3 /* TODO: label value */ | null {
    // TODO: replace with actual sampling from renderable data (e.g. texture buffer)
    return world; // stub - currently returns world coordinates instead of label value
  }
}
