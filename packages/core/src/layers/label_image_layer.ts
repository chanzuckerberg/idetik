import { Layer, LayerOptions } from "../core/layer";
import { Region } from "../data/region";
import { ImageChunk, ImageChunkSource } from "../data/image_chunk";
import { Texture2D } from "../objects/textures/texture_2d";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";
import { Color, ColorLike } from "../core/color";
import { LabelImageRenderable } from "../objects/renderable/label_image_renderable";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";

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
  private image_?: LabelImageRenderable;
  private dragStart_: vec2 | null = null;
  private readonly dragThreshold_ = 3;
  private clientToClip_?: (clientPos: vec2, depth: number) => vec3;

  constructor({
    source,
    region,
    colorCycle = DEFAULT_COLOR_CYCLE,
    colorMap = new Map(),
    onPickValue,
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
      case "pointerdown":
        this.handlePointerDown(event);
        break;
      case "pointermove":
        this.handlePointerMove(event);
        break;
      case "pointerup":
      case "pointercancel":
        this.handlePointerUpOrCancel(event);
        break;
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

  public setClientToClip(
    clientToClip: (clientPos: vec2, depth: number) => vec3
  ): void {
    this.clientToClip_ = clientToClip;
  }

  private handlePointerDown(event: EventContext): void {
    const pointerEvent = event.event as PointerEvent;
    this.dragStart_ = vec2.fromValues(
      pointerEvent.clientX,
      pointerEvent.clientY
    );
  }

  private handlePointerMove(event: EventContext): void {
    const pointerEvent = event.event as PointerEvent;
    if (!this.dragStart_) return;

    const currentPos = vec2.fromValues(
      pointerEvent.clientX,
      pointerEvent.clientY
    );
    const dist = vec2.distance(currentPos, this.dragStart_);

    if (dist > this.dragThreshold_) {
      // This is a pan gesture, reset drag start
      this.dragStart_ = null;
    }
  }

  private handlePointerUpOrCancel(event: EventContext): void {
    const pointerEvent = event.event as PointerEvent;

    // Only trigger pick if we haven't moved much (indicating a click, not a pan)
    if (this.dragStart_) {
      const currentPos = vec2.fromValues(
        pointerEvent.clientX,
        pointerEvent.clientY
      );
      const dist = vec2.distance(currentPos, this.dragStart_);

      if (dist <= this.dragThreshold_) {
        this.handleClick(pointerEvent);
        event.stopPropagation();
      }
    }

    this.dragStart_ = null;
  }

  private handleClick(event: PointerEvent): void {
    if (!this.clientToClip_ || !this.onPickValue_) return;

    const client = vec2.fromValues(event.clientX, event.clientY);
    const world = this.clientToWorld(client);
    const value = this.getValueAtWorld(world);

    this.onPickValue_({
      client,
      world,
      value,
      layer: this,
    });
  }

  private clientToWorld(client: vec2): vec3 {
    if (!this.clientToClip_) return vec3.fromValues(0, 0, 0);

    const clipPos = this.clientToClip_(client, 0);
    // Note: In a real implementation, this would need access to the camera
    // For now, we'll return the clip coordinates as world coordinates
    return clipPos;
  }

  public getValueAtWorld(world: vec3): unknown | null {
    if (!this.image_) return null;

    // Transform world coordinates to image coordinates
    const imageCoords = this.worldToImageCoordinates(world);

    // Get pixel value from image data
    return this.getPixelValue(imageCoords);
  }

  private worldToImageCoordinates(world: vec3): vec2 {
    if (!this.image_) return vec2.fromValues(0, 0);

    // This is a simplified transformation - in practice, you'd use the inverse
    // of the image's transformation matrix
    const x =
      world[0] / this.image_.transform.scale[0] -
      this.image_.transform.translation[0];
    const y =
      world[1] / this.image_.transform.scale[1] -
      this.image_.transform.translation[1];

    return vec2.fromValues(x, y);
  }

  private getPixelValue(imagePos: vec2): number | null {
    // This would need to sample from the actual image data
    // For now, return a placeholder value
    const x = Math.floor(imagePos[0]);
    const y = Math.floor(imagePos[1]);

    // Return coordinates as value for demonstration
    return x >= 0 && y >= 0 ? x + y * 1000 : null;
  }
}
