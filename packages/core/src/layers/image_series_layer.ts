import { Layer, LayerOptions } from "../core/layer";
import { Full, Interval, Region } from "../data/region";
import {
  ImageChunk,
  ImageChunkLoader,
  ImageChunkSource,
} from "../data/image_chunk";
import { Texture2D } from "../objects/textures/texture_2d";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import { AbortError, PromiseScheduler } from "../data/promise_scheduler";
import { ChannelProps } from "../objects/textures/channel";
import { ScalarImageRenderable } from "../objects/renderable/scalar_image_renderable";
import { ArrayImageRenderable } from "../objects/renderable/array_image_renderable";
import { imageRenderableFromChunk } from "@/objects/renderable/image_renderable";

export type ImageSeriesLayerProps = LayerOptions & {
  source: ImageChunkSource;
  region: Region;
  seriesDimensionName: string;
  channelProps?: ChannelProps[];
};

export type SeriesAttributes = {
  start: number;
  stop: number;
  scale: number;
  length: number;
};

type LoadingToken = {
  canceled: boolean;
  index: number;
};

type SetIndexResult = {
  success: boolean;
  reason?: "duplicate" | "canceled";
};

// Loads 2D+z image data (Z-stack) from an image source into renderable objects.
export class ImageSeriesLayer extends Layer {
  public readonly type = "ImageSeriesLayer";

  private readonly source_: ImageChunkSource;
  private readonly region_: Region;
  private readonly seriesDimensionName_: string;
  private readonly seriesIndex_: Interval | Full;
  private readonly scheduler_: PromiseScheduler = new PromiseScheduler(16);
  private readonly initialChannelProps_?: ChannelProps[];
  private readonly channelChangeCallbacks_: Array<() => void> = [];
  private loader_: ImageChunkLoader | null = null;
  private seriesAttributes_?: SeriesAttributes;
  private loadingToken_: LoadingToken | null = null;
  private texture_: Texture2D | Texture2DArray | null = null;
  private dataChunks_: ImageChunk[] = [];
  private channelProps_?: ChannelProps[];
  private image_?: ScalarImageRenderable | ArrayImageRenderable;
  private extent_?: { x: number; y: number };

  // TODO:(shlomnissan) Remove this parameter when chunk manager is used by default
  private readonly lod_?: number;

  constructor({
    source,
    region,
    seriesDimensionName,
    channelProps,
    lod,
    ...layerOptions
  }: ImageSeriesLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.lod_ = lod;
    this.seriesDimensionName_ = seriesDimensionName;
    const seriesDimensionalIndex = region.find(
      (x) => x.dimension == seriesDimensionName
    );
    if (seriesDimensionalIndex === undefined) {
      throw new Error(
        `Series dimension '${seriesDimensionName}' not in region ${JSON.stringify(region)}`
      );
    }
    if (seriesDimensionalIndex.index.type === "point") {
      throw new Error(
        "Series dimension index in region must be an interval or 'full', not a point value"
      );
    }
    this.seriesIndex_ = seriesDimensionalIndex.index;
    this.channelProps_ = channelProps;
    this.initialChannelProps_ = channelProps;
  }

  public get channelProps(): ChannelProps[] | undefined {
    return this.channelProps_;
  }
  public setChannelProps(channelProps: ChannelProps[]) {
    this.channelProps_ = channelProps;
    this.image_?.setChannelProps(channelProps);
    this.channelChangeCallbacks_.forEach((callback) => {
      callback();
    });
  }
  public resetChannelProps(): void {
    if (this.initialChannelProps_ !== undefined) {
      this.setChannelProps(this.initialChannelProps_);
    }
  }

  /** useSyncExternalStore() compatible subscribe function. */
  addChannelChangeCallback = (callback: () => void): (() => void) => {
    this.channelChangeCallbacks_.push(callback);
    return () => {
      this.removeChannelChangeCallback(callback);
    };
  };
  public removeChannelChangeCallback(callback: () => void): void {
    const index = this.channelChangeCallbacks_.indexOf(callback);
    if (index === undefined) {
      throw new Error(`Callback to remove could not be found: ${callback}`);
    }
    this.channelChangeCallbacks_.splice(index, 1);
  }

  public update() {
    if (this.state === "initialized") {
      this.loadSeriesAttributes();
    }
  }

  public async setPosition(position: number): Promise<SetIndexResult> {
    const seriesAttributes = await this.loadSeriesAttributes();
    const index = Math.round(
      (position - seriesAttributes.start) / seriesAttributes.scale
    );
    return await this.setIndex(index);
  }

  public async setIndex(index: number): Promise<SetIndexResult> {
    const token = this.loadingToken_;
    if (token) {
      if (token.index === index && !token.canceled) {
        console.debug("Ignoring duplicate active setIndex request");
        return { success: false, reason: "duplicate" };
      } else {
        console.debug(
          `Cancelling setIndex request for index ${token.index}, new requested index is ${index}`
        );
        token.canceled = true;
      }
    }

    const chunk = this.dataChunks_[index];
    if (chunk === undefined) {
      const newToken = { canceled: false, index: index };
      this.loadingToken_ = newToken;
      await this.loadAndSetIndex(index, newToken);
      if (newToken.canceled) return { success: false, reason: "canceled" };
    } else {
      this.setData(chunk);
    }
    return { success: true };
  }

  private setData(chunk: ImageChunk) {
    if (!this.texture_ || !this.image_) {
      this.image_ = imageRenderableFromChunk(chunk, this.channelProps_);
      this.addObject(this.image_);
      // extent does not change after renderable creation
      this.extent_ = {
        x: chunk.shape.x * chunk.scale.x,
        y: chunk.shape.y * chunk.scale.y,
      };
    } else if (chunk.data) {
      this.texture_.data = chunk.data;
    }
  }

  public close() {
    this.scheduler_.shutdown();
  }

  private async loadSeriesAttributes() {
    if (this.seriesAttributes_) {
      return this.seriesAttributes_;
    }
    const loader = await this.getLoader();
    const attributes = await loader.loadAttributes();
    const attributesForLOD = attributes[this.lod_ ?? attributes.length - 1];

    const seriesIndex = attributesForLOD.dimensionNames.findIndex(
      (dim) => dim === this.seriesDimensionName_
    );
    if (seriesIndex === -1) {
      throw new Error(
        `Series dimension "${this.seriesDimensionName_}" not found in loader dimensions: ${attributesForLOD.dimensionNames}`
      );
    }
    const seriesDimScale = attributesForLOD.scale[seriesIndex];
    const seriesMax = attributesForLOD.shape[seriesIndex] * seriesDimScale;

    const indexIsFull = this.seriesIndex_.type === "full";
    const seriesStart = indexIsFull ? 0 : this.seriesIndex_.start;
    const seriesStop = indexIsFull ? seriesMax : this.seriesIndex_.stop;

    const seriesLength = Math.round(
      (seriesStop - seriesStart) / seriesDimScale
    );
    this.dataChunks_ = new Array(seriesLength);

    this.seriesAttributes_ = {
      start: seriesStart,
      stop: seriesStop,
      scale: seriesDimScale,
      length: seriesLength,
    };
    return this.seriesAttributes_;
  }

  private async loadAndSetIndex(index: number, token?: LoadingToken) {
    const seriesAttributes = await this.loadSeriesAttributes();
    if (index < 0 || index >= seriesAttributes.length) {
      throw new Error(
        `Requested index ${index} is out of bounds [0, ${seriesAttributes.length - 1}]`
      );
    }

    // replace the series region with a point region for the requested index
    const position = seriesAttributes.start + index * seriesAttributes.scale;
    const pointRegion = this.region_.filter(
      (dimIndex) => dimIndex.dimension !== this.seriesDimensionName_
    );
    pointRegion.push({
      dimension: this.seriesDimensionName_,
      index: { type: "point", value: position },
    });

    const loader = await this.getLoader();
    const attributes = await loader.loadAttributes();
    const lod = this.lod_ ?? attributes.length - 1;

    const chunk = await loader.loadRegion(pointRegion, lod, this.scheduler_);
    this.dataChunks_[index] = chunk;

    if (token && !token.canceled) {
      this.loadingToken_ = null;
      this.setData(chunk);
      this.setState("ready");
    }
  }

  public async preloadSeries() {
    const { length } = await this.loadSeriesAttributes();
    // Load remaining slices concurrently, exclude the token so they don't get set
    const loadPromises = [];
    for (let index = 0; index < length; index++) {
      loadPromises.push(this.loadAndSetIndex(index));
    }

    // Wait for all slices to finish loading
    const results = await Promise.allSettled(loadPromises);
    for (const result of results) {
      if (result.status === "rejected") {
        if (result.reason instanceof AbortError) {
          // reject the promise because this means the layer was closed
          return Promise.reject(result.reason);
        } else {
          console.error(`Error loading slice: ${result.reason}`);
        }
      }
    }
  }

  public get extent(): { x: number; y: number } | undefined {
    return this.extent_;
  }

  private async getLoader() {
    this.loader_ ??= await this.source_.open();
    return this.loader_;
  }
}
