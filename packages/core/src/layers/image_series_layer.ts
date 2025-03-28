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
  }: ImageSeriesLayerProps) {
    super();
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

  public setChannelProps(channelProps: ChannelProps[]): void {
    this.channelProps_ = channelProps;
    this.renderable_?.setChannelProps(channelProps);
  }

  public update(): void {
    if (this.state === "initialized") {
      this.loadSeriesAttributes();
    }
  }

  public setPosition(position: number) {
    // this calls async from sync, but it is handled in setIndex by the loading token
    this.loadSeriesAttributes().then((attributes) => {
      const { start: seriesStart, scale: seriesDimScale } = attributes;
      const index = Math.round((position - seriesStart) / seriesDimScale);
      this.setIndex(index);
    });
  }

  public setIndex(index: number) {
    if (
      this.loadingToken_ &&
      this.loadingToken_.index === index &&
      !this.loadingToken_.canceled
    ) {
      console.debug("Ignoring duplicate active load index request");
      return;
    } else if (this.loadingToken_) {
      console.debug(
        `Cancelling load for index ${this.loadingToken_.index}, requested index is ${index}`
      );
      this.loadingToken_.canceled = true;
    }

    const chunk = this.dataChunks_[index];
    if (chunk === undefined) {
      this.loadingToken_ = { canceled: false, index: index };
      this.loadAndSetIndex(index, this.loadingToken_);
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
    this.setState("ready");
  }

  public close(): void {
    this.scheduler_.shutdown();
  }

  private async loadSeriesAttributes() {
    if (this.seriesAttributes_) {
      return this.seriesAttributes_;
    }
    this.setState("loading");
    const loader = await this.getLoader();

    const attributes = await loader.loadAttributes();
    const seriesIndex = attributes.dimensions.findIndex(
      (dim) => dim === this.seriesDimensionName_
    );
    if (seriesIndex === -1) {
      throw new Error(
        `Series dimension "${this.seriesDimensionName_}" not found in loader dimensions: ${attributes.dimensions}`
      );
    }
    const seriesDimScale = attributes.scale[seriesIndex];
    const seriesMax = attributes.shape[seriesIndex] * seriesDimScale;

    const indexIsFull = this.seriesIndex_.type === "full";
    const seriesStart = indexIsFull ? 0 : this.seriesIndex_.start;
    const seriesStop = indexIsFull ? seriesMax : this.seriesIndex_.stop;

    console.debug(
      `ImageSeriesLayer, loading index range: ${seriesStart}-${seriesStop} (${(seriesStop - seriesStart) / seriesDimScale - 1} slices) for dim ${this.seriesDimensionName_}`
    );

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
    if (token && !token.canceled && this.state !== "loading") {
      // if there is no token, we're only loading in the background
      this.setState("loading");
    }
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

    // Store the chunk at the correct index
    this.dataChunks_[index] = chunk;
    console.debug(
      `Loaded position ${position} (array index ${index}) for dim ${this.seriesDimensionName_}`
    );

    // set the data and mark the layer as ready if the token is valid
    if (token && !token.canceled) {
      console.debug(
        `Setting data for position ${position} (array index ${index}) for dim ${this.seriesDimensionName_}`
      );
      this.setData(chunk);
      this.loadingToken_ = null;
    } else if (token && token.canceled) {
      console.debug(
        `Not setting data for position ${position} (arry index ${index}) due to cancellation`
      );
    } else {
      console.debug(
        `Not setting data for position ${position} (arry index ${index}) due to no token`
      );
    }
  }

  public async preloadSeries({ initialIndex = 0 }: { initialIndex: number }) {
    console.debug(
      `Preloading series for dim ${this.seriesDimensionName_}, starting at index ${initialIndex}`
    );
    const { length } = await this.loadSeriesAttributes();
    // Load the initial slice first - use `setIndex` in case it's already loaded
    this.setIndex(initialIndex);
    // Load remaining slices concurrently, exclude the token so they don't get set
    const loadPromises = [];
    for (let index = 0; index < length; index++) {
      if (index !== initialIndex) {
        loadPromises.push(this.loadAndSetIndex(index));
      }
    }

    // Wait for all slices to finish loading
    const results = await Promise.allSettled(loadPromises);
    for (const result of results) {
      if (result.status === "rejected") {
        if (result.reason instanceof AbortError) {
          console.debug("Loading aborted.");
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
}
