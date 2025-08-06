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
  private imageChunk_?: ImageChunk;
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
    this.imageChunk_ = chunk; // Store chunk for value picking
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

    const pixelIndex = y * this.imageChunk_.rowStride + x;
    const data = this.imageChunk_.data;
    return data[pixelIndex];
  }
}
