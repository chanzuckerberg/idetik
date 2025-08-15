import { Layer, LayerOptions } from "../core/layer";
import { IdetikContext } from "../idetik";
import { Region2D, Region2DProps } from "../data/region";
import { Chunk, ChunkSource } from "../data/chunk";
import { ChunkManagerSource } from "../core/chunk_manager";
import { ChannelProps, ChannelsEnabled } from "../objects/textures/channel";
import { ImageRenderable } from "../objects/renderable/image_renderable";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";
import { Color } from "../core/color";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";
import { handlePointPickingEvent } from "../utilities/point_picking";
import { PointPickingResult } from "./label_image_layer";
import { DataTextureTypedArray } from "@/objects/textures/texture";

export type ImageLayerProps = LayerOptions & {
  source: ChunkSource;
  region: Region2DProps;
  channelProps?: ChannelProps[];
  onPickValue?: (info: PointPickingResult) => void;
};

// Loads data from an image source into renderable objects.
export class ImageLayer extends Layer implements ChannelsEnabled {
  public readonly type = "ImageLayer";

  private readonly source_: ChunkSource;
  // TODO: remove this when region is passed through to update.
  // https://github.com/chanzuckerberg/idetik/issues/33
  private readonly region_: Region2D;
  private readonly initialChannelProps_?: ChannelProps[];
  private readonly onPickValue_?: (info: PointPickingResult) => void;
  private readonly channelChangeCallbacks_: Array<() => void> = [];
  private readonly visibleChunks_: Map<Chunk, ImageRenderable> = new Map();
  private readonly images_: Map<string, ImageRenderable> = new Map();
  private chunkManagerSource_?: ChunkManagerSource;
  private channelProps_?: ChannelProps[];
  private image_?: ImageRenderable;
  private pointerDownPos_: vec2 | null = null;
  private readonly dragThreshold_ = 3;

  private readonly wireframeColors_ = [
    new Color(0.6, 0.3, 0.3),
    new Color(0.3, 0.6, 0.4),
    new Color(0.4, 0.4, 0.7),
    new Color(0.6, 0.5, 0.3),
  ];

  constructor({
    source,
    region,
    channelProps,
    onPickValue,
    ...layerOptions
  }: ImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.region_ = new Region2D(region);
    this.channelProps_ = channelProps;
    this.initialChannelProps_ = channelProps;
    this.onPickValue_ = onPickValue;
  }

  public async onAttached(context: IdetikContext) {
    this.chunkManagerSource_ = await context.chunkManager.addSource(
      this.source_,
      this.region_
    );
  }

  private updateChunks() {
    if (!this.chunkManagerSource_) return;

    // Temporary until we decide how to approach state management
    if (this.state !== "ready") {
      this.setState("ready");
    }

    // TODO:(shlomnissan) Reuse images instead of deleting and creating new ones.
    //
    // This loop removes image renderables for chunks that are no longer visible
    // or no longer returned by getChunks() (e.g., due to LOD changes).
    // While this approach works for now, it may be more efficient in the future
    // to reuse renderables by updating their underlying data instead of repeatedly
    // creating new texture objects. Note: GPU resources are not currently being
    // released, so this will also need to be addressed soon.
    const currentChunks = new Set(this.chunkManagerSource_.getChunks());
    this.visibleChunks_.forEach((image, chunk) => {
      if (!currentChunks.has(chunk)) {
        this.removeObject(image);
        this.images_.delete(chunkKey(chunk));
        this.visibleChunks_.delete(chunk); // safe
      }
    });

    currentChunks.forEach((chunk) => {
      if (chunk.state === "loaded" && !this.visibleChunks_.has(chunk)) {
        // TODO: instead of creating a new image, look for the one
        // associated with the chunk's xyz-lod index.
        const key = chunkKey(chunk);
        if (this.images_.has(key)) {
          const image = this.images_.get(key)!;
          this.visibleChunks_.set(chunk, image);
          this.addChunkToImage(chunk, image);
          return;
        }
        const image = this.createImage(chunk, this.channelProps);
        this.visibleChunks_.set(chunk, image);
        this.images_.set(key, image);
        this.addObject(image);
      }
    });
  }

  public update() {
    this.updateChunks();
  }

  public onEvent(event: EventContext) {
    this.pointerDownPos_ = handlePointPickingEvent(
      event,
      this.pointerDownPos_,
      this.dragThreshold_,
      (world) => this.getValueAtWorld(world),
      this.onPickValue_
    );
  }

  public get channelProps(): ChannelProps[] | undefined {
    // TODO: should this return Channel[] instead of ChannelProps[]?
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

  public addChannelChangeCallback(callback: () => void): void {
    this.channelChangeCallbacks_.push(callback);
  }
  public removeChannelChangeCallback(callback: () => void): void {
    const index = this.channelChangeCallbacks_.indexOf(callback);
    if (index === undefined) {
      throw new Error(`Callback to remove could not be found: ${callback}`);
    }
    this.channelChangeCallbacks_.splice(index, 1);
  }

  public get extent(): { x: number; y: number } | undefined {
    const source = this.chunkManagerSource;
    if (!source) return;
    const dimensions = source.getDimensions();
    if (dimensions.length == 0) return;
    const dimension = dimensions[0];
    return {
      x: dimension.x.size * dimension.x.scale,
      y: dimension.y.size * dimension.y.scale,
    };
  }

  public get chunkManagerSource(): ChunkManagerSource | undefined {
    return this.chunkManagerSource_;
  }

  private addChunkToImage(chunk: Chunk, image: ImageRenderable) {
    const channelDataSize = chunk.rowStride * chunk.shape.y;
    // TODO: handle typing properly.
    const texture = image.textures[0] as Texture2DArray;
    let channelChunkIndex = chunk.chunkIndex.c;
    if (this.region_.c?.type === "point") {
      channelChunkIndex = 0;
    }
    const offset = channelChunkIndex * channelDataSize;
    console.debug("addChunkToImage: ", { chunk, offset, texture });
    texture.data.set(chunk.data!, offset);
    texture.needsUpdate = true;
  }

  private createImage(chunk: Chunk, channelProps?: ChannelProps[]) {
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);

    const dimensions = this.chunkManagerSource!.getDimensions();
    const chunkData = chunk.data!;
    // TODO: the number of channels is also affected by the region.
    let numChannels = dimensions[0].c?.size ?? 1;
    let channelChunkIndex = chunk.chunkIndex.c;
    if (this.region_.c?.type === "point") {
      numChannels = 1;
      channelChunkIndex = 0;
    }
    const channelDataSize = chunk.rowStride * chunk.shape.y;
    const TypedArray = chunkData.constructor as new (
      size: number
    ) => DataTextureTypedArray;
    const data = new TypedArray(channelDataSize * numChannels);
    console.debug("createImage: ", {
      chunk,
      channelDataSize,
      numChannels,
      data,
    });
    data.set(chunkData, channelChunkIndex * channelDataSize);
    const texture = new Texture2DArray(data, chunk.shape.x, chunk.shape.y);
    texture.unpackRowLength = chunk.rowStride;
    texture.unpackAlignment = chunk.rowAlignmentBytes;
    console.debug("Created texture for chunk:", { chunk, texture });

    const image = new ImageRenderable(geometry, texture, channelProps);

    if (this.debugMode) {
      image.wireframeEnabled = true;
      image.wireframeColor =
        this.wireframeColors_[chunk.lod % this.wireframeColors_.length];
    }

    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
    return image;
  }

  public getValueAtWorld(world: vec3): number | null {
    // Iterate through all visible chunks to find the one containing the world position
    for (const [chunk, image] of this.visibleChunks_) {
      if (!chunk.data) continue;
      const localPos = vec3.transformMat4(
        vec3.create(),
        world,
        image.transform.inverse
      );

      const x = Math.floor(localPos[0]);
      const y = Math.floor(localPos[1]);

      // Check if this chunk contains the requested position
      if (x >= 0 && x < chunk.shape.x && y >= 0 && y < chunk.shape.y) {
        const pixelIndex = y * chunk.rowStride + x;
        const data = chunk.data;

        // For multi-channel images, take the first channel value
        return data[pixelIndex];
      }
    }
    return null;
  }
}

function chunkKey(chunk: Chunk): string {
  return `${chunk.chunkIndex.x},${chunk.chunkIndex.y},${chunk.chunkIndex.z},${chunk.lod}`;
}
