import { Region } from "./region";
import { TextureUnpackRowAlignment } from "../objects/textures/texture";
import { PromiseScheduler } from "./promise_scheduler";
import { Logger } from "../utilities/logger";

const chunkDataTypes = [
  Int8Array,
  Int16Array,
  Int32Array,
  Uint8Array,
  Uint16Array,
  Uint32Array,
  Float32Array,
] as const;
export type ChunkDataConstructor = (typeof chunkDataTypes)[number];
export type ChunkData = InstanceType<ChunkDataConstructor>;

export function isChunkData(value: unknown): value is ChunkData {
  if (chunkDataTypes.some((ChunkData) => value instanceof ChunkData)) {
    return true;
  }
  const supportedDataTypeNames = chunkDataTypes.map((dtype) => dtype.name);
  Logger.debug(
    "Chunk",
    `Unsupported chunk data type: ${value}. Supported data types: ${supportedDataTypeNames}`
  );
  return false;
}

export type ChunkState = "unloaded" | "queued" | "loading" | "loaded";

export type ChunkShape = {
  x: number;
  y: number;
  z: number;
  c: number;
};

export type ChunkIndex = {
  x: number;
  y: number;
  z: number;
  c: number;
  t: number;
};

export type ChunkScale = {
  x: number;
  y: number;
  z: number;
};

export type ChunkOffset = {
  x: number;
  y: number;
  z: number;
};

export interface ChunkObserver {
  onStateChange?(
    chunk: Chunk,
    oldState: ChunkState,
    newState: ChunkState
  ): void;
  onVisibilityChange?(chunk: Chunk, visible: boolean): void;
  onPrefetchChange?(chunk: Chunk, prefetch: boolean): void;
}

export type ChunkProps = {
  data?: ChunkData;
  state?: ChunkState;
  lod: number;
  visible?: boolean;
  prefetch?: boolean;
  priority?: number | null;
  orderKey?: number | null;
  shape: ChunkShape;
  rowAlignmentBytes: TextureUnpackRowAlignment;
  chunkIndex: ChunkIndex;
  scale: ChunkScale;
  offset: ChunkOffset;
};

export class Chunk {
  public data?: ChunkData;
  public rowAlignmentBytes: TextureUnpackRowAlignment;
  public priority: number | null;
  public orderKey: number | null;

  public readonly lod: number;
  public readonly shape: ChunkShape;
  public readonly chunkIndex: ChunkIndex;
  public readonly scale: ChunkScale;
  public readonly offset: ChunkOffset;

  private state_: ChunkState;
  private visible_: boolean;
  private prefetch_: boolean;

  private readonly observers_ = new Set<ChunkObserver>();

  constructor(params: ChunkProps) {
    this.data = params.data;
    this.state_ = params.state ?? "unloaded";
    this.lod = params.lod;
    this.visible_ = params.visible ?? false;
    this.prefetch_ = params.prefetch ?? false;
    this.priority = params.priority ?? null;
    this.orderKey = params.orderKey ?? null;
    this.shape = params.shape;
    this.rowAlignmentBytes = params.rowAlignmentBytes;
    this.chunkIndex = params.chunkIndex;
    this.scale = params.scale;
    this.offset = params.offset;
  }

  get state(): ChunkState {
    return this.state_;
  }

  set state(newState: ChunkState) {
    if (this.state_ !== newState) {
      const oldState = this.state_;
      this.state_ = newState;
      this.notifyStateChange(oldState, newState);
    }
  }

  get visible(): boolean {
    return this.visible_;
  }

  set visible(newVisible: boolean) {
    if (this.visible_ !== newVisible) {
      this.visible_ = newVisible;
      this.notifyVisibilityChange(newVisible);
    }
  }

  get prefetch(): boolean {
    return this.prefetch_;
  }

  set prefetch(newPrefetch: boolean) {
    if (this.prefetch_ !== newPrefetch) {
      this.prefetch_ = newPrefetch;
      this.notifyPrefetchChange(newPrefetch);
    }
  }

  public addObserver(observer: ChunkObserver): void {
    this.observers_.add(observer);
  }

  public removeObserver(observer: ChunkObserver): void {
    this.observers_.delete(observer);
  }

  private notifyStateChange(oldState: ChunkState, newState: ChunkState): void {
    for (const observer of this.observers_) {
      observer.onStateChange?.(this, oldState, newState);
    }
  }

  private notifyVisibilityChange(visible: boolean): void {
    for (const observer of this.observers_) {
      observer.onVisibilityChange?.(this, visible);
    }
  }

  private notifyPrefetchChange(prefetch: boolean): void {
    for (const observer of this.observers_) {
      observer.onPrefetchChange?.(this, prefetch);
    }
  }
}

// Maps Idetik spatial dimensions (x, y, z) and non-spatial dimensions (c, t)
// dimensions to a chunk source's dimensions.
export type SourceDimensionMap = {
  x: SourceDimension;
  y: SourceDimension;
  z?: SourceDimension;
  c?: SourceDimension;
  t?: SourceDimension;
  numLods: number;
};

// A dimension in a chunk source with multiple levels of detail (LODs).
export type SourceDimension = {
  name: string;
  index: number;
  unit?: string;
  lods: SourceDimensionLod[];
};

// Metadata for a source dimension at a specific level of detail (LOD)
// of a multi-resolution image pyramid.
// For example, combines zarr array metadata (size, chunkSize) with
// OME-zarr coordinate transform (scale, translation).
export type SourceDimensionLod = {
  size: number;
  chunkSize: number;
  scale: number;
  translation: number;
};

export type SliceCoordinates = {
  z?: number;
  c?: number;
  t?: number;
};

export type ChunkSource = {
  open(): Promise<ChunkLoader>;
};

export type LoaderAttributes = {
  dimensionNames: string[];
  dimensionUnits: (string | undefined)[];
  chunks: readonly number[];
  shape: readonly number[];
  scale: readonly number[];
  translation: readonly number[];
};

export type ChunkLoader = {
  loadRegion(
    input: Region,
    lod: number,
    scheduler?: PromiseScheduler
  ): Promise<Chunk>;

  getSourceDimensionMap(): SourceDimensionMap;

  loadChunkData(chunk: Chunk, signal: AbortSignal): Promise<void>;

  getAttributes(): ReadonlyArray<LoaderAttributes>;
};

export function coordToIndex(lod: SourceDimensionLod, coord: number): number {
  return Math.round((coord - lod.translation) / lod.scale);
}

export function coordToChunkIndex(
  lod: SourceDimensionLod,
  coord: number
): number {
  const index = coordToIndex(lod, coord);
  return Math.floor(index / lod.chunkSize);
}
