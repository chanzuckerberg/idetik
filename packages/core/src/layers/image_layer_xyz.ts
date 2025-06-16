import { Layer, LayerOptions } from "../core/layer";
import { IdetikContext } from "../idetik";
import { Region } from "../data/region";
import { ImageChunk, ImageChunkSource } from "../data/image_chunk";
import { ChunkManagerSource } from "../core/chunk_manager";
import { ChannelProps } from "../objects/textures/channel";
import { ImageRenderable } from "../objects/renderable/image_renderable";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";

export type ImageLayerProps = LayerOptions & {
  source: ImageChunkSource;
  region: Region;
  channelProps?: ChannelProps[];
};

export class ImageLayerXYZ extends Layer {
  private readonly source_: ImageChunkSource;
  private readonly region_: Region;
  private useChunkManager_: boolean;
  private chunkManagerSource_?: ChunkManagerSource;
  private channelProps_?: ChannelProps[];
  private image_?: ImageRenderable;
  private extent_?: { x: number; y: number };
  private visibleChunks_: ImageChunk[] = [];

  constructor({ source, channelProps, ...layerOptions }: ImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.channelProps_ = channelProps;

    const x = region.find((r) => r.dimension === "x");
    const y = region.find((r) => r.dimension === "y");
    this.useChunkManager_ =
      x?.index.type === "full" && y?.index.type === "full";
  }

  public async onAttached(context: IdetikContext) {
    this.chunkManagerSource_ = await context.chunkManager.addSource(
      this.source_
    );
  }

  public update() {
    if (this.useChunkManager_) {
      const chunks = this.chunkManagerSource_.getVisibleChunks();
      
      // Check if LOD has changed - if so, clear old chunks
      if (chunks.length > 0) {
        const currentLOD = chunks[0].lod;
        const hasLODChanged =
          this.visibleChunks_.length > 0 &&
          this.visibleChunks_[0].lod !== currentLOD;

        if (hasLODChanged) {
          this.clearObjects();
          this.visibleChunks_ = [];
        }
      }
      
      chunks.forEach((chunk) => {
        if (chunk.state === "loaded" && !this.visibleChunks_.includes(chunk)) {
          this.visibleChunks_.push(chunk);
          this.addObject(this.createImage(chunk, this.channelProps));
        }
      });
    } else {
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
    this.setState("ready");
  }

  public get channelProps(): ChannelProps[] | undefined {
    return this.channelProps_;
  }

  public setChannelProps(channelProps: ChannelProps[]) {
    this.channelProps_ = channelProps;
    this.image_?.setChannelProps(channelProps);
  }

  public get extent(): { x: number; y: number } | undefined {
    return this.extent_;
  }

  private createImage(chunk: ImageChunk, channelProps?: ChannelProps[]) {
    if (chunk.data) {
      let minVal = chunk.data[0];
      let maxVal = chunk.data[0];
      for (let i = 0; i < chunk.data.length; i++) {
        if (chunk.data[i] < minVal) minVal = chunk.data[i];
        if (chunk.data[i] > maxVal) maxVal = chunk.data[i];
      }
    }

    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);

    const image = new ImageRenderable(
      geometry,
      Texture2DArray.createWithImageChunk(chunk),
      channelProps
    );

    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
    return image;
  }
}
