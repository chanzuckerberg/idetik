import { Layer } from "core/layer";
import { Region } from "data/region";
import { ImageChunk, ImageChunkSource } from "data/image_chunk";
import { Texture2DArray } from "objects/textures/texture_2d_array";
import { AbortError, PromiseScheduler } from "data/promise_scheduler";
import { makeImageTextureArray, makeImageRenderable } from "layers/image_utils";
import { ChannelProps } from "objects/textures/channel";
import { ImageRenderable } from "objects/renderable/image_renderable";

type ImageStackLayerProps = {
  source: ImageChunkSource;
  region: Region;
  zDimension: string;
  channelProps?: ChannelProps[];
};

// Loads 2D+z image data (Z-stack) from an image source into renderable objects.
export class ImageStackLayer extends Layer {
  private readonly source_: ImageChunkSource;
  private readonly region_: Region;
  private readonly zDimension_: string;
  private texture_: Texture2DArray | null = null;
  private dataChunks_: ImageChunk[] = [];
  private scheduler_: PromiseScheduler = new PromiseScheduler(16);
  private channelProps_?: ChannelProps[];
  private renderable_?: ImageRenderable;
  private extent_?: { x: number; y: number };

  constructor({
    source,
    region,
    zDimension,
    channelProps,
  }: ImageStackLayerProps) {
    super();
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.zDimension_ = zDimension;
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

  public setZIndex(index: number) {
    if (this.state === "initialized") {
      // TODO: error instead?
      console.warn(`Trying to set Z index before ready: ${this.state}`);
      return;
    }
    if (index < 0 || index >= this.dataChunks_.length) {
      throw new Error(
        `Z index ${index} is out of bounds [0, ${this.dataChunks_.length - 1}]`
      );
    }
    this.setZIndex_(index);
  }

  private setZIndex_(index: number) {
    const chunk = this.dataChunks_[index];

    if (this.texture_ === null) {
      this.texture_ = makeImageTextureArray(chunk);
      this.renderable_ = makeImageRenderable(
        chunk,
        this.texture_,
        this.channelProps_
      );
      this.addObject(this.renderable_);
    } else {
      this.texture_.data = chunk.data;
    }
  }

  public close(): void {
    this.scheduler_.shutdown();
  }

  private async load() {
    if (this.state !== "initialized") {
      throw new Error(`Trying to open chunk loader more than once.`);
    }
    const loader = await this.source_.open();

    const attributes = await loader.loadAttributes();
    const zAxisIndex = attributes.dimensions.findIndex(
      (dim) => dim === this.zDimension_
    );
    if (zAxisIndex === -1) {
      throw new Error(
        `Z dimension "${this.zDimension_}" not found in loader dimensions: ${attributes.dimensions}`
      );
    }
    const zScale = attributes.scale[zAxisIndex];
    const zMax = attributes.shape[zAxisIndex] * zScale;

    const zRegion = this.region_.find(
      (dimIndex) => dimIndex.dimension === this.zDimension_
    );
    if (typeof zRegion?.index === "number") {
      throw new Error(
        "Z index in region must be a range (or empty), not a point value"
      );
    }
    const zStart = zRegion?.index.start ?? 0;
    const zStop = zRegion?.index.stop ?? zMax;
    console.debug(
      `ImageStackLayer, loading Z index range: ${zStart}-${zStop} (${(zStop - zStart) / zScale - 1} slices)`
    );

    this.dataChunks_ = [];
    const loadPromises = [];
    // Create a new region with the specific Z index in data coordinates
    const sliceRegion = this.region_.filter(
      (dimIndex) => dimIndex.dimension !== this.zDimension_
    );
    sliceRegion.push({ dimension: this.zDimension_, index: zStart });
    const numSlices = Math.round((zStop - zStart) / zScale);
    // Load each Z slice separately
    for (let slice = 0; slice < numSlices; slice++) {
      const zLoc = zStart + slice * zScale;
      sliceRegion[sliceRegion.length - 1].index = zLoc;
      // Queue loading this slice
      loadPromises.push(
        loader.loadChunk(sliceRegion, this.scheduler_).then((chunk) => {
          // Store the chunk at the correct index
          this.dataChunks_[slice] = chunk;
          console.debug(`Loaded Z slice ${zLoc} (array index ${slice})`);

          // If this is the first slice to load, we mark the layer as ready
          // and set the z index to the loaded slice
          if (this.state === "initialized") {
            this.extent_ = {
              x: chunk.shape.x * chunk.scale.x,
              y: chunk.shape.y * chunk.scale.y,
            };
            this.setZIndex_(slice);
            this.setState("loading");
          }
        })
      );
    }

    // Wait for all slices to finish loading
    await Promise.all(loadPromises).catch((error) => {
      if (error instanceof AbortError) {
        console.debug("Loading aborted.");
        return;
      }
      console.error("Error loading Z stack", error);
      throw error;
    });
    this.setState("ready");
    console.debug(`Loaded all ${this.dataChunks_.length} Z slices`);
  }

  public get extent(): { x: number; y: number } | undefined {
    return this.extent_;
  }
}
