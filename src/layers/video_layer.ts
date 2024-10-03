import { Layer } from "core/layer";
import { Mesh } from "objects/renderable/mesh";
import { PlaneGeometry } from "objects/geometry/plane_geometry";
import { Interval, Region } from "data/region";
import { ImageChunk } from "data/image_chunk";
import { DataTexture2D } from "objects/textures/data_texture_2d";

interface ImageLayerSource {
  open(): Promise<ImageChunkLoader>;
}

interface ImageChunkLoader {
  loadChunk(input: Region): Promise<ImageChunk>;
}

// Loads 2D+t image data from an image source into renderable objects.
export class VideoLayer extends Layer {
  private readonly source_: ImageLayerSource;
  // TODO: plane geometry should be defined by data source extents and region.
  // https://github.com/chanzuckerberg/imaging-active-learning/issues/35
  private readonly plane_ = new PlaneGeometry(3, 3, 1, 1);
  private readonly region_: Region;
  private readonly timeInterval_: Interval;
  private readonly timeDimensionIndex_: number;
  private dataChunks_: ImageChunk[] = [];

  constructor(source: ImageLayerSource, region: Region, timeDimension: string) {
    super();
    this.state_ = "initialized";
    this.source_ = source;
    this.region_ = region;
    this.timeDimensionIndex_ = region.findIndex(
      (x) => x.dimension == timeDimension
    );
    if (this.timeDimensionIndex_ === -1) {
      throw new Error(
        `Could not find dimension ${timeDimension} in ${JSON.stringify(region)}`
      );
    }
    const timeIndex = this.region_[this.timeDimensionIndex_].index;
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
    if (this.state_ !== "ready") {
      throw new Error(`Trying to set time index before ready: ${this.state_}`);
    }
    const { start, stop } = this.timeInterval_;
    const chunkIndex = Math.round(index - start);
    if (chunkIndex < 0) {
      throw new Error(`Time index ${index} is before the start time: ${start}`);
    } else if (chunkIndex >= this.dataChunks_.length) {
      throw new Error(`Time index ${index} is after the stop time: ${stop}.`);
    }
    const chunk = this.dataChunks_[chunkIndex];
    // TODO: create one object and update the texture in-place.
    // Or use a texture array and update the index for the shader.
    const texture = new DataTexture2D(
      chunk.data,
      chunk.shape.width,
      chunk.shape.height,
      chunk.rowStride,
      chunk.rowAlignmentBytes
    );
    this.clearObjects();
    this.addObject(new Mesh(this.plane_, texture));
  }

  private async load() {
    if (this.state_ !== "initialized") {
      throw new Error(`Trying to open chunk loader more than once.`);
    }
    this.state_ = "loading";
    const loader = await this.source_.open();
    // Wait to load the whole region over all time points.
    this.dataChunks_ = [];
    const region = structuredClone(this.region_);
    for (let t = this.timeInterval_.start; t < this.timeInterval_.stop; ++t) {
      region[this.timeDimensionIndex_].index = t;
      const chunk = await loader.loadChunk(region);
      this.dataChunks_.push(chunk);
    }
    this.state_ = "ready";
    // TODO: some way to notify that state changed to ready so that
    // slider can be kept in sync with time index.
    this.setTimeIndex(this.timeInterval_.start);
  }
}
