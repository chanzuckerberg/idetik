import { Layer } from "core/layer";
import { Full, Interval, Region } from "data/region";
import {
  ImageChunk,
  ImageChunkLoader,
  ImageChunkSource,
} from "data/image_chunk";
import { Texture2DArray } from "objects/textures/texture_2d_array";
import { AbortError, PromiseScheduler } from "data/promise_scheduler";
import { makeImageTextureArray, makeImageRenderable } from "layers/image_utils";
import { ChannelProps } from "objects/textures/channel";
import { ImageRenderable } from "objects/renderable/image_renderable";

type ImageSeriesLayerProps = {
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

// Loads 2D+z image data (Z-stack) from an image source into renderable objects.
export class ImageSeriesLayer extends Layer {
  private readonly source_: ImageChunkSource;
  private readonly region_: Region;
  private readonly seriesDimensionName_: string;
  private readonly seriesIndex_: Interval | Full;
  private readonly scheduler_: PromiseScheduler = new PromiseScheduler(16);
  private loader_: ImageChunkLoader | null = null;
  private seriesAttributes_?: SeriesAttributes;
  private loadingToken_: LoadingToken | null = null;
  private texture_: Texture2DArray | null = null;
  private dataChunks_: ImageChunk[] = [];
  private channelProps_?: ChannelProps[];
  private renderable_?: ImageRenderable;
  private extent_?: { x: number; y: number };

  constructor({
    source,
    region,
    seriesDimensionName,
    channelProps,
    ...layerOptions
  }: ImageSeriesLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
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
  }

  public get channelProps(): ChannelProps[] | undefined {
    return this.channelProps_;
  }

  public setChannelProps(channelProps: ChannelProps[]) {
    this.channelProps_ = channelProps;
    this.renderable_?.setChannelProps(channelProps);
  }

  public update() {
    if (this.state === "initialized") {
      this.loadSeriesAttributes();
    }
  }

  public async setPosition(position: number) {
    const seriesAttributes = await this.loadSeriesAttributes();
    const index = Math.round(
      (position - seriesAttributes.start) / seriesAttributes.scale
    );
    this.setIndex(index);
  }

  public async setIndex(index: number) {
    const token = this.loadingToken_;
    if (token) {
      if (token.index === index && !token.canceled) {
        console.debug("Ignoring duplicate active setIndex request");
        return;
      } else {
        console.debug(
          `Cancelling setIndex request for index ${token.index}, new requested index is ${index}`
        );
        token.canceled = true;
      }
    }

    const chunk = this.dataChunks_[index];
    if (chunk === undefined) {
      this.loadingToken_ = { canceled: false, index: index };
      await this.loadAndSetIndex(index, this.loadingToken_);
      return;
    }
    this.setData(chunk);
  }

  private setData(chunk: ImageChunk) {
    if (!this.texture_ || !this.renderable_) {
      this.texture_ = makeImageTextureArray(chunk);
      this.renderable_ = makeImageRenderable(
        chunk,
        this.texture_,
        this.channelProps_
      );
      // extent does not change after renderable creation
      this.extent_ = {
        x: chunk.shape.x * chunk.scale.x,
        y: chunk.shape.y * chunk.scale.y,
      };
      this.addObject(this.renderable_);
    } else {
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
    this.setState("loading");
    const loader = await this.getLoader();

    const attributes = await loader.loadAttributes();
    const seriesIndex = attributes.dimensionNames.findIndex(
      (dim) => dim === this.seriesDimensionName_
    );
    if (seriesIndex === -1) {
      throw new Error(
        `Series dimension "${this.seriesDimensionName_}" not found in loader dimensions: ${attributes.dimensionNames}`
      );
    }
    const seriesDimScale = attributes.scale[seriesIndex];
    const seriesMax = attributes.shape[seriesIndex] * seriesDimScale;

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
    this.setState("ready");
    return this.seriesAttributes_;
  }

  private async loadAndSetIndex(index: number, token?: LoadingToken) {
    this.setLoadingStateFromToken(token);

    const seriesAttributes = await this.loadSeriesAttributes();
    if (index < 0 || index >= seriesAttributes.length) {
      throw new Error(
        `Requested index ${index} is out of bounds [0, ${seriesAttributes.length - 1}]`
      );
    }
    const loader = await this.getLoader();

    // replace the series region with a point region for the requested index
    const position = seriesAttributes.start + index * seriesAttributes.scale;
    const pointRegion = this.region_.filter(
      (dimIndex) => dimIndex.dimension !== this.seriesDimensionName_
    );
    pointRegion.push({
      dimension: this.seriesDimensionName_,
      index: { type: "point", value: position },
    });

    const chunk = await loader.loadChunk(pointRegion, this.scheduler_);

    this.dataChunks_[index] = chunk;
    console.debug(
      `Loaded data for position ${position} (array index ${index})`
    );
    if (!token) {
      console.debug(
        `Not setting data for position ${position} (array index ${index}) - loaded in background`
      );
      return;
    }

    if (token.canceled) {
      console.debug(
        `Not setting data for position ${position} (array index ${index}) - canceled by subsequent request`
      );
    } else {
      console.debug(
        `Setting data for position ${position} (array index ${index})`
      );
      this.loadingToken_ = null;
      this.setData(chunk);
      this.setState("ready");
    }
  }

  public async preloadSeries() {
    console.debug(`Preloading series for dim ${this.seriesDimensionName_}`);
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
    if (!results.some((result) => result.status === "rejected")) {
      console.debug(
        `Loaded all ${this.dataChunks_.length} slices for dim ${this.seriesDimensionName_}`
      );
    }
  }

  public get extent(): { x: number; y: number } | undefined {
    return this.extent_;
  }

  private async getLoader(): Promise<ImageChunkLoader> {
    if (this.loader_) {
      return this.loader_;
    }
    return await this.source_.open();
  }

  private setLoadingStateFromToken(token?: LoadingToken) {
    if (!!token && !token.canceled && this.state !== "loading") {
      this.setState("loading");
    }
  }
}
