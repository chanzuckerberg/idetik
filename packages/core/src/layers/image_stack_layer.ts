import { Layer } from "core/layer";
import { Region } from "data/region";
import { ImageChunk } from "data/image_chunk";
import { OmeZarrImageSource } from "data/ome_zarr_image_source";
import { Texture2DArray } from "objects/textures/texture_2d_array";
import { AbortError, PromiseScheduler } from "data/promise_scheduler";
import { makeImageTextureArray, makeImageRenderable } from "layers/image_utils";
import { ChannelProps } from "objects/textures/channel";
import { ImageRenderable } from "objects/renderable/image_renderable";

type ImageStackLayerProps = {
  source: OmeZarrImageSource;
  region: Region;
  zDimension: string;
  channelProps?: ChannelProps[];
};

// Loads 2D+z image data (Z-stack) from an image source into renderable objects.
export class ImageStackLayer extends Layer {
  private readonly source_: OmeZarrImageSource;
  private readonly region_: Region;
  private readonly zDimension_: string;
  private readonly zDimensionIndex_: number;
  private texture_: Texture2DArray | null = null;
  private dataChunks_: ImageChunk[] = [];
  private scheduler_: PromiseScheduler = new PromiseScheduler(16);
  private channelProps_?: ChannelProps[];
  private renderable_?: ImageRenderable;
  private extent_?: { x: number; y: number };
  private currentZIndex_: number = 0;

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

    this.zDimensionIndex_ = region.findIndex((x) => x.dimension == zDimension);
    if (this.zDimensionIndex_ === -1) {
      throw new Error(
        `Could not find dimension ${zDimension} in ${JSON.stringify(region)}`
      );
    }
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
    if (this.state !== "ready") {
      console.warn(`Trying to set Z index before ready: ${this.state}`);
      return;
    }
    if (index < 0 || index >= this.dataChunks_.length) {
      throw new Error(
        `Z index ${index} is out of bounds [0, ${this.dataChunks_.length - 1}]`
      );
    }

    this.currentZIndex_ = index;
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

  public getCurrentZIndex(): number {
    return this.currentZIndex_;
  }

  public getZSize(): number {
    return this.dataChunks_.length;
  }

  public close(): void {
    this.scheduler_.shutdown();
  }

  private async load() {
    if (this.state !== "initialized") {
      throw new Error(`Trying to open chunk loader more than once.`);
    }
    this.setState("loading");
    const loader = await this.source_.open();

    // Get the metadata to understand the dimensions
    const metadata = loader.metadata;
    const axes = metadata.multiscales[0].axes;
    const zAxisIndex = axes.findIndex((axis) => axis.name === this.zDimension_);

    if (zAxisIndex === -1) {
      throw new Error(
        `Z dimension "${this.zDimension_}" not found in metadata axes`
      );
    }

    // Get the Z region element to determine how to load
    const zRegionElement = this.region_[this.zDimensionIndex_];

    // If the Z index is a specific number, we just need to load that one slice
    if (typeof zRegionElement.index === "number") {
      // Single slice to load
      try {
        const chunk = await loader.loadChunk(this.region_, this.scheduler_);
        this.dataChunks_ = [chunk];

        this.extent_ = {
          x: chunk.shape.x * chunk.scale.x,
          y: chunk.shape.y * chunk.scale.y,
        };

        this.setState("ready");
        this.setZIndex(0);
      } catch (error) {
        console.error("Error loading single Z slice", error);
        throw error;
      }
      return;
    }

    // Handle the case where the Z dimension is an interval
    try {
      // Get the indices representation of our region to determine Z range
      const indices = loader.regionToIndices(this.region_);
      const zIndices = indices[zAxisIndex];

      if (typeof zIndices === "number") {
        throw new Error(
          `Z dimension indices should be an interval, not a number`
        );
      }

      // Get the start and stop indices for Z
      const zStart = zIndices.start === null ? 0 : zIndices.start;
      const zStop = zIndices.stop === null ? 1 : zIndices.stop;
      console.debug(
        `Z index range: ${zStart}-${zStop} (${zStop - zStart} slices)`
      );

      // Load each Z slice separately
      this.dataChunks_ = [];
      const loadPromises = [];

      for (let zIndex = zStart; zIndex < zStop; zIndex++) {
        // Create a new region with the specific Z index in data coordinates
        const sliceRegion = structuredClone(this.region_);

        // Convert the array index back to data coordinates
        // For now, just use the original region's Z dimension but replace the interval with a scalar
        if (typeof sliceRegion[this.zDimensionIndex_].index !== "number") {
          // Get the Z coordinate by reverse-mapping the index to data space
          const dataset = metadata.multiscales[0].datasets[0];
          const scale = dataset.coordinateTransformations[0].scale;
          const translation =
            dataset.coordinateTransformations.length === 2
              ? dataset.coordinateTransformations[1].translation
              : new Array(axes.length).fill(0);

          // Apply the scale and translation in reverse
          const zCoord = zIndex * scale[zAxisIndex] - translation[zAxisIndex];
          sliceRegion[this.zDimensionIndex_].index = zCoord;
        }

        // Queue loading this slice
        loadPromises.push(
          loader.loadChunk(sliceRegion, this.scheduler_).then((chunk) => {
            // Store the chunk at the correct index
            const arrayIndex = zIndex - zStart;
            this.dataChunks_[arrayIndex] = chunk;
            console.debug(
              `Loaded Z slice ${zIndex} (array index ${arrayIndex})`
            );

            // If this is the first chunk to load, we can mark the layer as ready
            // This allows for progressive loading
            if (this.state !== "ready" && arrayIndex === 0) {
              this.extent_ = {
                x: chunk.shape.x * chunk.scale.x,
                y: chunk.shape.y * chunk.scale.y,
              };
              this.setState("ready");
              this.setZIndex(0);
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

      console.debug(`Loaded all ${this.dataChunks_.length} Z slices`);
    } catch (error) {
      if (error instanceof AbortError) {
        console.debug("Loading aborted.");
        return;
      }
      console.error("Error loading Z stack", error);
      throw error;
    }
  }

  public get extent(): { x: number; y: number } | undefined {
    return this.extent_;
  }
}
