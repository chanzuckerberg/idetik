import { Layer, LayerOptions } from "../core/layer";
import { Region } from "../data/region";
import { Chunk, ChunkSource } from "../data/chunk";
import { ChannelProps, ChannelsEnabled } from "../objects/textures/channel";
import { ImageRenderable } from "../objects/renderable/image_renderable";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";
import { handlePointPickingEvent, PointPickingResult } from "./point_picking";

export type ImageLayerProps = LayerOptions & {
  source: ChunkSource;
  region: Region;
  channelProps?: ChannelProps[];
  onPickValue?: (info: PointPickingResult) => void;
  lod?: number;
};

export class ImageLayer extends Layer implements ChannelsEnabled {
  public readonly type = "ImageLayer";

  private readonly source_: ChunkSource;
  private readonly region_: Region;
  private readonly lod_?: number;
  private readonly onPickValue_?: (info: PointPickingResult) => void;
  private readonly initialChannelProps_?: ChannelProps[];
  private readonly channelChangeCallbacks_: Array<() => void> = [];
  private channelProps_?: ChannelProps[];
  private image_?: ImageRenderable;
  private chunk_?: Chunk;
  private extent_?: { x: number; y: number };
  private pointerDownPos_: vec2 | null = null;

  constructor({
    source,
    region,
    channelProps,
    onPickValue,
    lod,
    ...layerOptions
  }: ImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.channels_ = new Channels(channelProps);
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
    this.pointerDownPos_ = handlePointPickingEvent(
      event,
      this.pointerDownPos_,
      (world) => this.getValueAtWorld(world),
      this.onPickValue_
    );
  }

  public get channelProps(): ChannelProps[] | undefined {
    return this.channels_.props;
  }

  public setChannelProps(channelProps: ChannelProps[]) {
    this.image_?.setChannelProps(channelProps);
    this.channels_.setProps(channelProps);
  }

  public resetChannelProps(): void {
    this.channels_.resetProps();
  }

  public addChannelChangeCallback(callback: () => void): void {
    this.channels_.addChangeCallback(callback);
  }

  public removeChannelChangeCallback(callback: () => void): void {
    this.channels_.removeChangeCallback(callback);
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
    this.extent_ = {
      x: chunk.shape.x * chunk.scale.x,
      y: chunk.shape.y * chunk.scale.y,
    };

    this.image_ = this.createImage(chunk);
    this.chunk_ = chunk;
    this.addObject(this.image_);

    this.setState("ready");
  }

  // TODO: we probably want something like this, but it should be unified across layers
  // see TracksLayer for another example
  public get extent(): { x: number; y: number } | undefined {
    return this.extent_;
  }

  private createImage(chunk: Chunk) {
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);
    const image = new ImageRenderable(
      geometry,
      Texture2DArray.createWithChunk(chunk),
      this.channelProps
    );
    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
    return image;
  }

  public getValueAtWorld(world: vec3): number | null {
    if (!this.image_) return null;
    if (!this.chunk_?.data) return null;
    const localPos = vec3.transformMat4(
      vec3.create(),
      world,
      this.image_.transform.inverse
    );

    const x = Math.floor(localPos[0]);
    const y = Math.floor(localPos[1]);

    // Check if this chunk contains the requested position
    if (
      x >= 0 &&
      x < this.chunk_.shape.x &&
      y >= 0 &&
      y < this.chunk_.shape.y
    ) {
      const pixelIndex = y * this.chunk_.rowStride + x;
      // For multi-channel images, take the first channel value
      return this.chunk_.data[pixelIndex];
    }

    return null;
  }
}
