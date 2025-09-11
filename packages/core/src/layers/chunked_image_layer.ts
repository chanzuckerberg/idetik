import { Layer, LayerOptions } from "../core/layer";
import { IdetikContext } from "../idetik";
import { Chunk, ChunkSource, SliceCoordinates } from "../data/chunk";
import { ChunkManagerSource } from "../core/chunk_manager";
import { ChannelProps, ChannelsEnabled } from "../objects/textures/channel";
import { ImageRenderable } from "../objects/renderable/image_renderable";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";
import { Logger } from "../utilities/logger";
import { Color } from "../core/color";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";
import { handlePointPickingEvent, PointPickingResult } from "./point_picking";
import { almostEqual } from "../utilities/almost_equal";
import { clamp } from "../utilities/clamp";
import { RenderablePool } from "../utilities/renderable_pool";

export type ChunkedImageLayerProps = LayerOptions & {
  source: ChunkSource;
  sliceCoords: SliceCoordinates;
  channelProps?: ChannelProps[];
  onPickValue?: (info: PointPickingResult) => void;
};

export class ChunkedImageLayer extends Layer implements ChannelsEnabled {
  public readonly type = "ChunkedImageLayer";

  private readonly source_: ChunkSource;
  private readonly sliceCoords_: SliceCoordinates;
  private readonly onPickValue_?: (info: PointPickingResult) => void;
  private readonly visibleChunks_: Map<Chunk, ImageRenderable> = new Map();
  private readonly pool_ = new RenderablePool<ImageRenderable>();
  private readonly initialChannelProps_?: ChannelProps[];
  private readonly channelChangeCallbacks_: (() => void)[] = [];
  private channelProps_?: ChannelProps[];
  private chunkManagerSource_?: ChunkManagerSource;
  private pointerDownPos_: vec2 | null = null;
  private zPrevPointWorld_?: number;
  private debugMode_ = false;
  private isNavigatingZ_ = false;
  private zNavigationTimer_?: NodeJS.Timeout;

  private readonly wireframeColors_ = [
    new Color(0.6, 0.3, 0.3),
    new Color(0.3, 0.6, 0.4),
    new Color(0.4, 0.4, 0.7),
    new Color(0.6, 0.5, 0.3),
  ];

  constructor({
    source,
    sliceCoords,
    channelProps,
    onPickValue,
    ...layerOptions
  }: ChunkedImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.sliceCoords_ = sliceCoords;
    this.channelProps_ = channelProps;
    this.initialChannelProps_ = channelProps;
    this.onPickValue_ = onPickValue;
  }

  public async onAttached(context: IdetikContext) {
    this.chunkManagerSource_ = await context.chunkManager.addSource(
      this.source_,
      this.sliceCoords_
    );
  }

  public update() {
    this.updateChunks();
    this.resliceIfZChanged();
  }

  private updateChunks() {
    if (!this.chunkManagerSource_) return;
    if (this.state !== "ready") this.setState("ready");

    const orderedByLOD = this.chunkManagerSource_.getChunks();
    const current = new Set(orderedByLOD);

    // Log chunk changes for LOD analysis
    const prevLODs = Array.from(this.visibleChunks_.keys())
      .map((c) => c.lod)
      .sort();
    const newLODs = orderedByLOD.map((c) => c.lod).sort();
    const lodsChanged = JSON.stringify(prevLODs) !== JSON.stringify(newLODs);

    if (lodsChanged || orderedByLOD.length !== this.visibleChunks_.size) {
      console.log("[ChunkedImageLayer] Chunks updated:", {
        previousLODs: prevLODs,
        newLODs: newLODs,
        chunkCount: orderedByLOD.length,
        loadedChunks: orderedByLOD.filter((c) => c.state === "loaded").length,
      });
    }

    this.visibleChunks_.forEach((image, chunk) => {
      if (!current.has(chunk)) {
        this.visibleChunks_.delete(chunk);
        this.pool_.release(poolKeyForImageRenderable(chunk), image);
      }
    });

    this.clearObjects();
    for (const chunk of orderedByLOD) {
      if (chunk.state !== "loaded") continue;
      const image = this.getImageForChunk(chunk);
      this.visibleChunks_.set(chunk, image);
      this.addObject(image);
    }
  }

  private resliceIfZChanged() {
    const zPointWorld = this.sliceCoords_.z;
    if (zPointWorld === undefined || this.zPrevPointWorld_ === zPointWorld) {
      return;
    }

    // Track z-navigation state for LOD stability
    this.isNavigatingZ_ = true;
    if (this.zNavigationTimer_) {
      clearTimeout(this.zNavigationTimer_);
    }
    this.zNavigationTimer_ = setTimeout(() => {
      this.isNavigatingZ_ = false;
    }, 500); // Stop considering it "navigation" after 500ms of no changes

    console.log("[ChunkedImageLayer] Reslicing:", {
      newZWorld: zPointWorld,
      prevZWorld: this.zPrevPointWorld_,
      visibleChunksCount: this.visibleChunks_.size,
      chunkLODs: Array.from(this.visibleChunks_.keys()).map(
        (chunk) => chunk.lod
      ),
      isNavigatingZ: this.isNavigatingZ_,
    });

    for (const [chunk, image] of this.visibleChunks_) {
      if (chunk.state !== "loaded" || !chunk.data) continue;
      const data = this.slicePlane(chunk, zPointWorld);
      if (data) {
        const texture = image.textures[0] as Texture2DArray;
        texture.updateWithChunk(chunk, data);
      }
    }

    this.zPrevPointWorld_ = zPointWorld;
  }

  public onEvent(event: EventContext) {
    this.pointerDownPos_ = handlePointPickingEvent(
      event,
      this.pointerDownPos_,
      (world) => this.getValueAtWorld(world),
      this.onPickValue_
    );
  }

  public get chunkManagerSource(): ChunkManagerSource | undefined {
    return this.chunkManagerSource_;
  }

  /**
   * Get all valid Z slice positions based on the chunk coordinate system.
   * This accounts for chunk boundaries, scales, and offsets from the OME-Zarr metadata.
   */
  public getValidZSlicePositions(): number[] {
    console.log('📍 [ChunkedImageLayer] getValidZSlicePositions ENTRY');
    if (!this.chunkManagerSource_) {
      console.log('📍 [ChunkedImageLayer] No chunkManagerSource available');
      return [];
    }
    
    const chunks = this.chunkManagerSource_.getChunks();
    console.log('📍 [ChunkedImageLayer] Found chunks:', chunks.length);
    
    const validPositions = new Set<number>();
    
    for (const chunk of chunks) {
      const chunkStartZ = chunk.offset.z;
      const chunkScale = chunk.scale.z;
      const chunkSliceCount = chunk.shape.z;
      
      console.log(`📍 Chunk LOD ${chunk.lod}: startZ=${chunkStartZ}, scale=${chunkScale}, sliceCount=${chunkSliceCount}`);
      
      for (let i = 0; i < chunkSliceCount; i++) {
        const slicePosition = chunkStartZ + (i * chunkScale);
        validPositions.add(slicePosition);
      }
    }
    
    const sorted = Array.from(validPositions).sort((a, b) => a - b);
    console.log('📍 [ChunkedImageLayer] Final valid positions count:', sorted.length);
    if (sorted.length > 0) {
      console.log('📍 [ChunkedImageLayer] Range:', sorted[0], 'to', sorted[sorted.length - 1]);
      console.log('📍 [ChunkedImageLayer] First 10:', sorted.slice(0, 10));
    }
    
    return sorted;
  }

  /**
   * Find the closest valid Z slice position to a given world coordinate.
   */
  public getClosestValidZPosition(targetZ: number): number {
    console.log('🎯 [ChunkedImageLayer] getClosestValidZPosition ENTRY with targetZ:', targetZ);
    const validPositions = this.getValidZSlicePositions();
    console.log('🎯 [ChunkedImageLayer] Got validPositions:', validPositions.length, 'positions');
    
    if (validPositions.length === 0) {
      console.log('🎯 [ChunkedImageLayer] No valid positions, returning targetZ:', targetZ);
      return targetZ;
    }
    
    let closest = validPositions[0];
    let minDistance = Math.abs(targetZ - closest);
    
    for (const position of validPositions) {
      const distance = Math.abs(targetZ - position);
      if (distance < minDistance) {
        minDistance = distance;
        closest = position;
      }
    }
    
    console.log('🎯 [ChunkedImageLayer] Closest position found:', closest, 'for target:', targetZ);
    return closest;
  }

  private slicePlane(chunk: Chunk, zValue: number) {
    if (!chunk.data) return;
    const zLocal = (zValue - chunk.offset.z) / chunk.scale.z;
    const zIdx = Math.round(zLocal);
    const zClamped = clamp(zIdx, 0, chunk.shape.z - 1);

    // Log slicing details to identify interpolation issues
    const isNonInteger = Math.abs(zLocal - zIdx) > 0.01; // More than 1% off integer
    if (isNonInteger) {
      console.log("[ChunkedImageLayer] Non-integer slice position:", {
        chunkLOD: chunk.lod,
        zValue: zValue,
        chunkOffset: chunk.offset.z,
        chunkScale: chunk.scale.z,
        zLocal: zLocal,
        zIdx: zIdx,
        zClamped: zClamped,
        interpolationError: Math.abs(zLocal - zIdx),
        chunkShape: chunk.shape,
        // Additional debug info
        expectedAlignment: chunk.offset.z + zIdx * chunk.scale.z,
        actualAlignment: zValue,
        alignmentDiff: zValue - (chunk.offset.z + zIdx * chunk.scale.z),
      });
    }

    // Treat values within ~1 voxel (plus tiny floating-point error) as OK.
    // Anything further away means the requested zValue is outside.
    if (!almostEqual(zLocal, zClamped, 1 + 1e-6)) {
      Logger.error("ImageLayer", "slicePlane zValue outside extent");
    }

    const sliceSize = chunk.shape.x * chunk.shape.y;
    const offset = sliceSize * zClamped;
    return chunk.data.slice(offset, offset + sliceSize);
  }

  private getImageForChunk(chunk: Chunk) {
    const existing = this.visibleChunks_.get(chunk);
    if (existing) return existing;

    const pooled = this.pool_.acquire(poolKeyForImageRenderable(chunk));
    if (pooled) {
      const texture = pooled.textures[0] as Texture2DArray;
      texture.updateWithChunk(chunk, this.getDataForImage(chunk));
      this.updateImageChunk(pooled, chunk);
      if (this.channelProps_) {
        pooled.setChannelProps(this.channelProps_);
      }
      return pooled;
    }

    return this.createImage(chunk);
  }

  private createImage(chunk: Chunk) {
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);
    const image = new ImageRenderable(
      geometry,
      Texture2DArray.createWithChunk(chunk, this.getDataForImage(chunk)),
      this.channelProps_ ?? [{}]
    );
    this.updateImageChunk(image, chunk);
    return image;
  }

  private getDataForImage(chunk: Chunk) {
    const data =
      this.sliceCoords_?.z !== undefined
        ? this.slicePlane(chunk, this.sliceCoords_.z)
        : chunk.data;
    if (!data) {
      Logger.warn("ChunkedImageLayer", "No data for image");
      return;
    }
    return data;
  }

  private updateImageChunk(image: ImageRenderable, chunk: Chunk) {
    if (this.debugMode_) {
      image.wireframeEnabled = true;
      image.wireframeColor =
        this.wireframeColors_[chunk.lod % this.wireframeColors_.length];
    } else {
      image.wireframeEnabled = false;
    }
    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
  }

  public getValueAtWorld(world: vec3): number | null {
    const currentLOD = this.chunkManagerSource_?.currentLOD ?? 0;

    // First, try to find the value in current LOD chunks (highest priority)
    for (const [chunk, image] of this.visibleChunks_) {
      if (chunk.lod !== currentLOD) continue;
      const value = this.getValueFromChunk(chunk, image, world);
      if (value !== null) return value;
    }

    // Fallback to low-res chunks if no current LOD chunk contains the position
    for (const [chunk, image] of this.visibleChunks_) {
      if (chunk.lod === currentLOD) continue;
      const value = this.getValueFromChunk(chunk, image, world);
      if (value !== null) return value;
    }

    return null;
  }

  private getValueFromChunk(
    chunk: Chunk,
    image: ImageRenderable,
    world: vec3
  ): number | null {
    if (!chunk.data) return null;

    const localPos = vec3.transformMat4(
      vec3.create(),
      world,
      image.transform.inverse
    );

    const x = Math.floor(localPos[0]);
    const y = Math.floor(localPos[1]);

    // Check if this chunk contains the requested position
    if (x >= 0 && x < chunk.shape.x && y >= 0 && y < chunk.shape.y) {
      const data =
        this.sliceCoords_.z !== undefined
          ? this.slicePlane(chunk, this.sliceCoords_.z)!
          : chunk.data;
      const pixelIndex = y * chunk.rowStride + x;

      // For multi-channel images, take the first channel value
      return data[pixelIndex];
    }

    return null;
  }

  public set debugMode(debug: boolean) {
    this.debugMode_ = debug;
    this.visibleChunks_.forEach((image, chunk) => {
      image.wireframeEnabled = this.debugMode_;
      if (this.debugMode_) {
        image.wireframeColor =
          this.wireframeColors_[chunk.lod % this.wireframeColors_.length];
      }
    });
  }

  public get channelProps(): ChannelProps[] | undefined {
    return this.channelProps_;
  }

  public setChannelProps(channelProps: ChannelProps[]) {
    this.channelProps_ = channelProps;
    this.visibleChunks_.forEach((image) => {
      image.setChannelProps(channelProps);
    });
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
    if (index === -1) {
      throw new Error(`Callback to remove could not be found: ${callback}`);
    }
    this.channelChangeCallbacks_.splice(index, 1);
  }
}

export function poolKeyForImageRenderable(chunk: Chunk) {
  return [
    `lod${chunk.lod}`,
    `shape${chunk.shape.x}x${chunk.shape.y}`,
    `stride${chunk.rowStride}`,
    `align${chunk.rowAlignmentBytes}`,
  ].join(":");
}
