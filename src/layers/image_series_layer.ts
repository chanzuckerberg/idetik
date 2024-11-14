import { Layer } from "core/layer";
import { Mesh } from "objects/renderable/mesh";
import { PlaneGeometry } from "objects/geometry/plane_geometry";
import { Interval, Region } from "data/region";
import { ImageChunk, ImageChunkSource } from "data/image_chunk";
import { Texture2DArray } from "objects/textures/texture_2d_array";

// Loads 2D+t image data from an image source into renderable objects.
export class ImageSeriesLayer extends Layer {
  private readonly source_: ImageChunkSource;
  private readonly region_: Region;
  private readonly timeDimension_: string;
  private readonly timeInterval_: Interval;
  private texture_: Texture2DArray | null = null;
  private dataChunks_: ImageChunk[] = [];

  constructor(source: ImageChunkSource, region: Region, timeDimension: string) {
    super();
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.timeDimension_ = timeDimension;
    const timeIndex = this.region_.get(timeDimension);
    if (timeIndex === undefined) {
      throw new Error(
        `Could not find dimension ${timeDimension} in ${JSON.stringify(region)}`
      );
    }
    if (typeof timeIndex === "number") {
      throw new Error(
        `Time index is a number (${timeIndex}). It should be an interval.`
      );
    }
    this.timeInterval_ = timeIndex;
  }

  public update(): void {
    switch (this.state) {
      case "initialized":
        this.load();
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

  public setTimeIndex(index: number) {
    if (this.state !== "ready") {
      console.warn(`Trying to set time index before ready: ${this.state}`);
      return;
    }
    const { start, stop } = this.timeInterval_;
    const chunkIndex = index - start;
    if (chunkIndex < 0) {
      throw new Error(`Time index ${index} is before the start time: ${start}`);
    } else if (chunkIndex >= this.dataChunks_.length) {
      throw new Error(`Time index ${index} is after the stop time: ${stop}.`);
    }
    const chunk = this.dataChunks_[chunkIndex];
    if (this.texture_ === null) {
      this.initializeTexture(chunk);

      // This ignores the order of the dimensions specified in the input region.
      // Instead it relies on the order defined by the source, and that the bytes
      // are expected to be iterated in a C-like order (i.e. row-wise).
      const indices = Array.from(chunk.region.values());
      console.debug("indices", indices);
      const origin = indices.map((index) => index.start);
      const size = indices.map((index) => index.stop - index.start);

      const plane = new PlaneGeometry(size[2], size[1], 1, 1, origin[2], origin[1]);
      this.addObject(new Mesh(plane, this.texture_));
    } else {
      this.texture_.data = chunk.data;
    }
  }

  private async load() {
    if (this.state !== "initialized") {
      throw new Error(`Trying to open chunk loader more than once.`);
    }
    this.setState("loading");
    const loader = await this.source_.open();
    // Wait to load the whole region over all time points.
    this.dataChunks_ = [];
    const loadPromises = [];
    const { start, stop } = this.timeInterval_;
    // TODO: this assumes that time-steps are unitary when they might
    // have a scale associated with them. We could instead load the
    // whole region in and map back the chunks appropriately.
    // https://github.com/chanzuckerberg/imaging-active-learning/issues/75
    for (let t = start; t < stop; ++t) {
      const region = structuredClone(this.region_);
      region.set(this.timeDimension_, t);
      loadPromises.push(
        loader
          .loadChunk(region)
          .then((chunk) => (this.dataChunks_[t - start] = chunk))
      );
    }
    await Promise.all(loadPromises);

    this.setState("ready");
  }

  private initializeTexture(chunk: ImageChunk) {
    this.texture_ = new Texture2DArray(
      chunk.data,
      chunk.shape[2],
      chunk.shape[1],
    );

    this.texture_.unpackRowLength = chunk.stride[1];
    this.texture_.unpackAlignment = chunk.rowAlignmentBytes;
    this.texture_.dataFormat = "red_integer";
    if (chunk.data instanceof Uint16Array) {
      this.texture_.dataType = "unsigned_short";
    }
  }
}
