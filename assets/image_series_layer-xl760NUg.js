import { L as Layer } from "./metadata_loaders-CXLkXwNR.js";
import { T as Texture2DArray, P as PlaneGeometry, I as ImageRenderable } from "./image_source-BemCU8_Z.js";
class AbortError extends Error {
  constructor(message) {
    super(message);
    this.name = "AbortError";
    Object.setPrototypeOf(this, AbortError.prototype);
  }
}
class PromiseScheduler {
  maxConcurrent_;
  pending_ = [];
  abortController_ = new AbortController();
  numRunning_ = 0;
  constructor(maxConcurrent) {
    if (maxConcurrent <= 0) {
      throw Error(`maxConcurrent (${maxConcurrent}) must be positive`);
    }
    this.maxConcurrent_ = maxConcurrent;
  }
  async submit(task) {
    this.abortController_.signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const promise = async () => {
        try {
          this.abortController_.signal.throwIfAborted();
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.numRunning_--;
          this.maybeRunNext();
        }
      };
      this.pending_.push(promise);
      this.maybeRunNext();
    });
  }
  maybeRunNext() {
    if (this.numRunning_ >= this.maxConcurrent_) return;
    const promise = this.pending_.shift();
    if (promise === void 0) return;
    this.numRunning_++;
    promise();
  }
  get abortSignal() {
    return this.abortController_.signal;
  }
  shutdown() {
    this.abortController_.abort(new AbortError("shutdown"));
  }
  get numRunning() {
    return this.numRunning_;
  }
  get numPending() {
    return this.pending_.length;
  }
}
class ImageSeriesLoader {
  source_;
  region_;
  seriesDimensionName_;
  seriesIndex_;
  scheduler_ = new PromiseScheduler(16);
  lod_;
  loader_ = null;
  seriesAttributes_;
  loadingToken_ = null;
  dataChunks_ = [];
  constructor(props) {
    this.source_ = props.source;
    this.region_ = props.region;
    this.lod_ = props.lod;
    this.seriesDimensionName_ = props.seriesDimensionName;
    const seriesDimensionalIndex = props.region.find(
      (x) => x.dimension == props.seriesDimensionName
    );
    if (seriesDimensionalIndex === void 0) {
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
  async setPosition(position) {
    const seriesAttributes = await this.loadSeriesAttributes();
    const index = Math.round(
      (position - seriesAttributes.start) / seriesAttributes.scale
    );
    return await this.setIndex(index);
  }
  async setIndex(index) {
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
    if (chunk === void 0) {
      const newToken = { canceled: false, index };
      this.loadingToken_ = newToken;
      chunk = await this.loadChunkAtIndex(index, newToken);
      if (newToken.canceled) return { success: false, reason: "canceled" };
    }
    return { success: true, chunk };
  }
  shutdown() {
    this.scheduler_.shutdown();
  }
  async loadSeriesAttributes() {
    if (this.seriesAttributes_) {
      return this.seriesAttributes_;
    }
    const loader = await this.getLoader();
    const attributes = loader.getAttributes();
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
      length: seriesLength
    };
    return this.seriesAttributes_;
  }
  async loadChunkAtIndex(index, token) {
    const seriesAttributes = await this.loadSeriesAttributes();
    if (index < 0 || index >= seriesAttributes.length) {
      throw new Error(
        `Requested index ${index} is out of bounds [0, ${seriesAttributes.length - 1}]`
      );
    }
    const position = seriesAttributes.start + index * seriesAttributes.scale;
    const pointRegion = this.region_.filter(
      (dimIndex) => dimIndex.dimension !== this.seriesDimensionName_
    );
    pointRegion.push({
      dimension: this.seriesDimensionName_,
      index: { type: "point", value: position }
    });
    const loader = await this.getLoader();
    const attributes = loader.getAttributes();
    const lod = this.lod_ ?? attributes.length - 1;
    const chunk = await loader.loadRegion(pointRegion, lod, this.scheduler_);
    this.dataChunks_[index] = chunk;
    if (token && token.canceled) {
      this.loadingToken_ = null;
    }
    return chunk;
  }
  async preloadAllChunks() {
    const { length } = await this.loadSeriesAttributes();
    const loadPromises = [];
    for (let index = 0; index < length; index++) {
      loadPromises.push(this.loadChunkAtIndex(index));
    }
    const results = await Promise.allSettled(loadPromises);
    for (const result of results) {
      if (result.status === "rejected") {
        if (result.reason instanceof AbortError) {
          return Promise.reject(result.reason);
        } else {
          console.error(`Error loading slice: ${result.reason}`);
        }
      }
    }
  }
  async getLoader() {
    this.loader_ ??= await this.source_.open();
    return this.loader_;
  }
}
class ImageSeriesLayer extends Layer {
  type = "ImageSeriesLayer";
  seriesLoader_;
  initialChannelProps_;
  channelChangeCallbacks_ = [];
  channelProps_;
  texture_ = null;
  image_;
  extent_;
  constructor({
    source,
    region,
    seriesDimensionName,
    channelProps,
    lod,
    ...layerOptions
  }) {
    super(layerOptions);
    this.setState("initialized");
    this.channelProps_ = channelProps;
    this.initialChannelProps_ = channelProps;
    this.seriesLoader_ = new ImageSeriesLoader({
      source,
      region,
      seriesDimensionName,
      lod
    });
  }
  update() {
    if (this.state === "initialized") {
      this.setState("loading");
      this.seriesLoader_.loadSeriesAttributes();
    }
  }
  get channelProps() {
    return this.channelProps_;
  }
  setChannelProps(channelProps) {
    this.channelProps_ = channelProps;
    this.image_?.setChannelProps(channelProps);
    this.channelChangeCallbacks_.forEach((callback) => {
      callback();
    });
  }
  resetChannelProps() {
    if (this.initialChannelProps_ !== void 0) {
      this.setChannelProps(this.initialChannelProps_);
    }
  }
  addChannelChangeCallback(callback) {
    this.channelChangeCallbacks_.push(callback);
  }
  removeChannelChangeCallback(callback) {
    const index = this.channelChangeCallbacks_.indexOf(callback);
    if (index === void 0) {
      throw new Error(`Callback to remove could not be found: ${callback}`);
    }
    this.channelChangeCallbacks_.splice(index, 1);
  }
  async setPosition(position) {
    const result = await this.seriesLoader_.setPosition(position);
    return this.processIndexResult(result);
  }
  async setIndex(index) {
    const result = await this.seriesLoader_.setIndex(index);
    return this.processIndexResult(result);
  }
  close() {
    this.seriesLoader_.shutdown();
  }
  async preloadSeries() {
    return this.seriesLoader_.preloadAllChunks();
  }
  get extent() {
    return this.extent_;
  }
  processIndexResult(result) {
    if (result.chunk) {
      this.setData(result.chunk);
      this.setState("ready");
    }
    return result;
  }
  setData(chunk) {
    if (!this.texture_ || !this.image_) {
      this.texture_ = Texture2DArray.createWithChunk(chunk);
      this.image_ = this.createImage(chunk, this.texture_, this.channelProps_);
      this.addObject(this.image_);
      this.extent_ = {
        x: chunk.shape.x * chunk.scale.x,
        y: chunk.shape.y * chunk.scale.y
      };
    } else if (chunk.data) {
      this.texture_.updateWithChunk(chunk);
    }
  }
  createImage(chunk, texture, channelProps) {
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);
    const image = new ImageRenderable(geometry, texture, channelProps);
    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
    return image;
  }
}
export {
  ImageSeriesLayer as I,
  ImageSeriesLoader as a
};
//# sourceMappingURL=image_series_layer-xl760NUg.js.map
