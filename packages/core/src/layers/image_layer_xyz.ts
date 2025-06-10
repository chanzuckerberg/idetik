import { Layer, LayerOptions } from "../core/layer";
import { IdetikContext } from "../idetik";
import { Region } from "../data/region";
import {
  ImageChunk,
  ImageChunkLoader,
  ImageChunkSource,
  LoaderAttributes,
} from "../data/image_chunk";
import { ChunkManagerSource } from "../core/chunk_manager";
import { ChannelProps } from "../objects/textures/channel";
import { ImageRenderable } from "../objects/renderable/image_renderable";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";
import { LODResult } from "../core/chunk_manager";

export type ImageLayerProps = LayerOptions & {
  source: ImageChunkSource;
  region: Region;
  channelProps?: ChannelProps[];
};

export class ImageLayerXYZ extends Layer {
  private readonly source_: ImageChunkSource;
  private readonly region_: Region;
  private chunkManagerSource_?: ChunkManagerSource;
  private channelProps_?: ChannelProps[];
  private image_?: ImageRenderable;
  private extent_?: { x: number; y: number };
  private context_?: IdetikContext;
  private currentLOD_?: LODResult;
  private attributes_: LoaderAttributes[] | undefined;
  private loader_: ImageChunkLoader | undefined;

  constructor({
    source,
    region,
    channelProps,
    ...layerOptions
  }: ImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.channelProps_ = channelProps;
  }

  private async ensureLoader(): Promise<ImageChunkLoader> {
    if (!this.loader_) {
      this.loader_ = await this.source_.open();
    }
    return this.loader_;
  }

  private async ensureAttributes(): Promise<LoaderAttributes[]> {
    if (!this.attributes_) {
      const loader = await this.ensureLoader();
      this.attributes_ = await loader.loadAttributes();
    }
    return this.attributes_;
  }

  public async onAttached(context: IdetikContext): Promise<void> {
    // TODO: context.chunkManager.addSource(this.source_)
    this.context_ = context;
    await this.ensureLoader(); // preload loader early
    await this.ensureAttributes(); // preload attributes early
    this.chunkManagerSource_ = await context.chunkManager.addSource(
      this.source_
    );
  }

  public update() {
    if (!this.chunkManagerSource_) return;

    const chunks = this.chunkManagerSource_.getVisibleChunks();
    chunks.forEach((_) => {
      // TODO: create image renderable for visible chunks if needed
    });

    switch (this.state) {
      case "initialized":
        this.load(this.region_);
        break;
      case "loading":
        break;
      case "ready":
        this.updateLOD();
        break;
      default: {
        const exhaustiveCheck: never = this.state;
        throw new Error(`Unhandled LayerState case: ${exhaustiveCheck}`);
      }
    }
  }

  public get channelProps(): ChannelProps[] | undefined {
    return this.channelProps_;
  }

  public setChannelProps(channelProps: ChannelProps[]) {
    this.channelProps_ = channelProps;
    this.image_?.setChannelProps(channelProps);
  }

  private async load(region: Region) {
    if (this.state !== "initialized") {
      throw new Error(`Trying to load chunks more than once.`);
    }
    this.setState("loading");
    const loader = await this.ensureLoader();

    const attributes = await this.ensureAttributes();
    // Use computed LOD if available; otherwise default to lowest resolution
    const lod = this.currentLOD_?.scaleIndex ?? attributes.length - 1;

    const chunk = await loader.loadChunk(region, lod);

    this.extent_ = {
      x: chunk.shape.x * chunk.scale.x,
      y: chunk.shape.y * chunk.scale.y,
    };

    this.image_ = this.createImage(chunk, this.channelProps_);
    this.addObject(this.image_);

    this.setState("ready");
  }

  public get extent(): { x: number; y: number } | undefined {
    return this.extent_;
  }

  private createImage(chunk: ImageChunk, channelProps?: ChannelProps[]) {
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

  private async updateLOD() {
    if (!this.context_) {
      return;
    }

    try {
      const camera = this.context_.getCamera();
      const viewport = this.context_.getViewport();
      const attributes = await this.ensureAttributes();
      const availableScales = attributes.map((attr) => attr.scale);

      const lodResult = this.context_.chunkManager.computeLOD(
        camera,
        viewport.width,
        viewport.height,
        availableScales
      );

      if (
        !this.currentLOD_ ||
        lodResult.scaleIndex !== this.currentLOD_.scaleIndex
      ) {
        this.currentLOD_ = lodResult;
        this.reloadWithScale(lodResult.scaleIndex);
      }
    } catch (error) {
      console.warn("Failed to compute LOD:", error);
    }
  }

  private async reloadWithScale(lod: number) {
    if (!this.image_) {
      return;
    }

    try {
      const loader = await this.ensureLoader();
      const chunk = await loader.loadChunk(this.region_, lod);

      this.extent_ = {
        x: chunk.shape.x * chunk.scale.x,
        y: chunk.shape.y * chunk.scale.y,
      };

      this.clearObjects();
      this.image_ = this.createImage(chunk, this.channelProps_);
      this.addObject(this.image_);
    } catch (error) {
      console.warn("Failed to reload with new scale:", error);
    }
  }

  public get currentLOD(): LODResult | undefined {
    return this.currentLOD_;
  }
}
