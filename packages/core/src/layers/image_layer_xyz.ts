import { Layer, LayerOptions } from "../core/layer";
import { IdetikContext } from "../idetik";
import { Region } from "../data/region";
import {
  ImageChunk,
  ImageChunkSource,
  ImageChunkLoader,
} from "../data/image_chunk";
import { ChannelProps } from "../objects/textures/channel";
import { ImageRenderable } from "../objects/renderable/image_renderable";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";
import { LODResult } from "../core/chunk_manager";
import { OmeZarrImageLoader } from "../data/ome_zarr_image_loader";

export type ImageLayerProps = LayerOptions & {
  source: ImageChunkSource;
  region: Region;
  channelProps?: ChannelProps[];
};

export class ImageLayerXYZ extends Layer {
  private readonly source_: ImageChunkSource;
  private readonly region_: Region;
  private channelProps_?: ChannelProps[];
  private image_?: ImageRenderable;
  private extent_?: { x: number; y: number };
  private context_?: IdetikContext;
  private availableScales_?: number[][];
  private currentLOD_?: LODResult;

  // TODO:(shlomnissan) Remove this parameter—LOD will be computed
  // dynamically by the chunk manager.
  private readonly lod_?: number;

  constructor({
    source,
    region,
    channelProps,
    lod,
    ...layerOptions
  }: ImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.lod_ = lod;
    this.channelProps_ = channelProps;
  }

  public onAttached(context: IdetikContext): void {
    // TODO: context.chunkManager.addSource(this.source_)
    this.context_ = context;
  }

  public update() {
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
    const loader = await this.source_.open();
    
    // await this.loadAvailableScales(loader);
    // const chunk = await loader.loadChunk(region);

    const attributes = await loader.loadAttributes();
    const lod = this.lod_ ?? attributes.length - 1;

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

  private async loadAvailableScales(loader: ImageChunkLoader) {
    if (loader instanceof OmeZarrImageLoader) {
      // TODO: Support multiple multiscales (pyramids) per image.
      // Currently assumes multiscales[0] is the only pyramid, which is typical for most datasets.
      // In future, we could expose a way to select which pyramid to use. (e.g. a dropdown?)
      const image = loader.metadata_.multiscales[0];
      this.availableScales_ = image.datasets.map(
        (dataset) => dataset.coordinateTransformations[0].scale
      );
    } else {
      const attributes = await loader.loadAttributes();
      this.availableScales_ = [Array.from(attributes.scale)];
    }
  }

  private updateLOD() {
    if (!this.context_ || !this.availableScales_) {
      return;
    }

    try {
      const camera = this.context_.getCamera();
      const viewport = this.context_.getViewport();

      const lodResult = this.context_.chunkManager.computeLOD(
        camera,
        viewport.width,
        viewport.height,
        this.availableScales_
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

  private async reloadWithScale(scaleIndex: number) {
    if (!this.image_) {
      return;
    }

    try {
      const loader = await this.source_.open();
      if (loader instanceof OmeZarrImageLoader) {
        loader.scaleIndex_ = scaleIndex;
      }

      const chunk = await loader.loadChunk(this.region_);

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
