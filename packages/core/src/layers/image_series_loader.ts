import { Full, Interval, Region } from "../data/region";
import {
  ImageChunk,
  ImageChunkLoader,
  ImageChunkSource,
} from "../data/image_chunk";
import { AbortError, PromiseScheduler } from "../data/promise_scheduler";

type SeriesAttributes = {
  start: number;
  stop: number;
  scale: number;
  length: number;
};

type LoadingToken = {
  canceled: boolean;
  index: number;
};

export type SetIndexResult = {
  success: boolean;
  reason?: "duplicate" | "canceled";
  chunk?: ImageChunk;
};

type ImageSeriesLoaderProps = {
  source: ImageChunkSource;
  region: Region;
  seriesDimensionName: string;
  lod?: number;
};

export class ImageSeriesLoader {
  private readonly source_: ImageChunkSource;
  private readonly region_: Region;
  private readonly seriesDimensionName_: string;
  private readonly seriesIndex_: Interval | Full;
  private readonly scheduler_: PromiseScheduler = new PromiseScheduler(16);
  private readonly lod_?: number;
  private loader_: ImageChunkLoader | null = null;
  private seriesAttributes_?: SeriesAttributes;
  private loadingToken_: LoadingToken | null = null;
  public dataChunks_: ImageChunk[] = [];

  constructor(props: ImageSeriesLoaderProps) {
    this.source_ = props.source;
    this.region_ = props.region;
    this.lod_ = props.lod;
    this.seriesDimensionName_ = props.seriesDimensionName;
    const seriesDimensionalIndex = props.region.find(
      (x) => x.dimension == props.seriesDimensionName
    );
    if (seriesDimensionalIndex === undefined) {
      throw new Error(
        `Series dimension '${props.seriesDimensionName}' not in region ${JSON.stringify(props.region)}`
      );
    }
    if (seriesDimensionalIndex.index.type === "point") {
      throw new Error(
        "Series dimension index in region must be an interval or 'full', not a point value"
      );
    }
    this.seriesIndex_ = seriesDimensionalIndex.index;
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
    let chunk = this.dataChunks_[index];
    if (chunk === undefined) {
      const newToken = { canceled: false, index: index };
      this.loadingToken_ = newToken;
      chunk = await this.loadChunkAtIndex(index, newToken);
      if (newToken.canceled) return { success: false, reason: "canceled" };
    }
    return { success: true, chunk };
  }

  public shutdown() {
    this.scheduler_.shutdown();
  }

  public async loadSeriesAttributes() {
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

  public async loadChunkAtIndex(index: number, token?: LoadingToken) {
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

    if (token && token.canceled) {
      this.loadingToken_ = null;
    }
    return chunk;
  }

  public async preloadAllChunks() {
    const { length } = await this.loadSeriesAttributes();
    // Load remaining slices concurrently, exclude the token so they don't get set
    const loadPromises = [];
    for (let index = 0; index < length; index++) {
      loadPromises.push(this.loadChunkAtIndex(index));
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

  private async getLoader() {
    this.loader_ ??= await this.source_.open();
    return this.loader_;
  }
}
