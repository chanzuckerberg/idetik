import { Layer, LayerOptions } from "../core/layer";
import { Region } from "../data/region";
import { ImageChunk, ImageChunkSource } from "../data/image_chunk";
import { Texture2D } from "../objects/textures/texture_2d";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";
import { Color, ColorLike } from "../core/color";
import { LabelImageRenderable } from "../objects/renderable/label_image_renderable";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";
import { Camera } from "../objects/cameras/camera";
import { ClientToClip } from "../core/types";

export interface PointPickingResult {
  client: vec2;
  world: vec3;
  value: unknown | null;
  layer: LabelImageLayer | null;
}

export type LabelImageLayerProps = LayerOptions & {
  source: ImageChunkSource;
  region: Region;
  colorCycle?: ColorLike[];
  colorMap?: ReadonlyMap<number, ColorLike>;
  onPickValue?: (info: PointPickingResult) => void;
  camera?: Camera;
  clientToClip?: ClientToClip;
};

const DEFAULT_COLOR_CYCLE: ColorLike[] = [
  [1.0, 0.5, 0.5],
  [0.5, 1.0, 0.5],
  [0.5, 0.5, 1.0],
  [0.5, 1.0, 1.0],
  [1.0, 0.5, 1.0],
  [1.0, 1.0, 0.5],
];

export class LabelImageLayer extends Layer {
  public readonly type = "LabelImageLayer";

  private readonly source_: ImageChunkSource;
  private readonly region_: Region;
  private readonly lod_?: number;
  private readonly colorCycle_: ReadonlyArray<Color>;
  private readonly colorMap_: ReadonlyMap<number, Color>;
  private readonly onPickValue_?: (info: PointPickingResult) => void;
  private readonly camera_?: Camera;
  private readonly clientToClip_?: ClientToClip;
  private image_?: LabelImageRenderable;
  private pointerDownPos_: vec2 | null = null;
  private readonly dragThreshold_ = 3;

  constructor({
    source,
    region,
    colorCycle = DEFAULT_COLOR_CYCLE,
    colorMap = new Map(),
    onPickValue,
    camera,
    clientToClip,
    lod,
    ...layerOptions
  }: LabelImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.colorCycle_ = colorCycle.map(Color.from);
    this.colorMap_ = new Map(
      Array.from(colorMap.entries()).map(([key, value]) => [
        key,
        Color.from(value),
      ])
    );
    this.onPickValue_ = onPickValue;
    this.camera_ = camera;
    this.clientToClip_ = clientToClip;
    this.lod_ = lod;

    if (this.onPickValue_ && (!this.camera_ || !this.clientToClip_)) {
      throw new Error(
        "camera and clientToClip are required when onPickValue is provided"
      );
    }
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

        this.pointerDownPos_ = null;

        if (dist < this.dragThreshold_) {
          const client = pointerUpPos;
          const clipPos = this.clientToClip_!(client, 0);
          const world = this.camera_!.clipToWorld(clipPos);
          const value = this.getValueAtWorld(world);

          if (value !== null) {
            this.onPickValue_({ client, world, value, layer: this });
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
      colorCycle: this.colorCycle_,
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
