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

export type Chunk = {
  data?: ChunkData;
  state: "unloaded" | "queued" | "loading" | "loaded";
  lod: number;
  visible: boolean;
  prefetch: boolean;
  priority: number | null;
  orderKey: number | null;
  shape: {
    x: number;
    y: number;
    z: number;
    c: number;
  };
  rowAlignmentBytes: TextureUnpackRowAlignment;
  chunkIndex: {
    x: number;
    y: number;
    z: number;
    c: number;
    t: number;
  };
  scale: {
    x: number;
    y: number;
    z: number;
  };
  offset: {
    x: number;
    y: number;
    z: number;
  };
};

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

type SliceIndex = {
  readonly z?: number;
  readonly t?: number;
  readonly c?: number;
};

type SliceCoordinatesProps = {
  z?: SliceCoordinate | number;
  t?: SliceCoordinate | number;
  c?: number;
};

export class SliceCoordinates {
  readonly zCoord?: SliceCoordinate;
  readonly tCoord?: SliceCoordinate;
  readonly cIndex?: number;

  constructor(props: SliceCoordinatesProps) {
    this.zCoord =
      typeof props.z === "number"
        ? new SliceCoordinate({ value: props.z })
        : props.z;
    this.tCoord =
      typeof props.t === "number"
        ? new SliceCoordinate({ value: props.t })
        : props.t;
    this.cIndex = props.c;
  }

  public get z(): number | undefined {
    return this.zCoord?.value;
  }

  public set z(value: number | undefined) {
    if (this.zCoord && value !== undefined) {
      this.zCoord.value = value;
    }
  }

  public get t(): number | undefined {
    return this.tCoord?.value;
  }

  public set t(value: number | undefined) {
    if (this.tCoord && value !== undefined) {
      this.tCoord.value = value;
    }
  }

  public get c(): number | undefined {
    return this.cIndex;
  }

  public toIndex(dimensions: SourceDimensionMap, lod: number): SliceIndex {
    let z;
    if (this.zCoord && dimensions.z) {
      z = this.zCoord.toIndex(dimensions.z.lods[lod]);
    }
    let t;
    if (this.tCoord && dimensions.t) {
      t = this.tCoord.toIndex(dimensions.t.lods[lod]);
    }
    return { z, t, c: this.cIndex };
  }

  public toChunkIndex(dimensions: SourceDimensionMap, lod: number): SliceIndex {
    let z;
    if (this.zCoord && dimensions.z) {
      z = this.zCoord.toChunkIndex(dimensions.z.lods[lod]);
    }
    let t;
    if (this.tCoord && dimensions.t) {
      t = this.tCoord.toChunkIndex(dimensions.t.lods[lod]);
    }
    let c;
    if (this.cIndex !== undefined && dimensions.c) {
      c = indexToChunkIndex(dimensions.c.lods[lod], this.cIndex);
    }
    return { z, t, c };
  }
}

type SliceCoordinateProps = {
  value: number;
};

class SliceCoordinate {
  private value_: number;
  private observers_: ChangeObserver<number>[] = [];

  constructor({ value }: SliceCoordinateProps) {
    this.value_ = value;
  }

  public get value(): number {
    return this.value_;
  }

  public set value(newValue: number) {
    if (newValue === this.value_) return;
    const oldValue = this.value_;
    this.value_ = newValue;
    this.observers_.forEach((observer) =>
      observer.onChanged(oldValue, newValue)
    );
  }

  public toIndex(lod: SourceDimensionLod): number {
    return coordToIndex(lod, this.value_);
  }

  public toChunkIndex(lod: SourceDimensionLod): number {
    return coordToChunkIndex(lod, this.value_);
  }

  public addChangeObserver(observer: ChangeObserver<number>): void {
    this.observers_.push(observer);
  }
}

type ChangeObserver<T> = {
  onChanged(oldValue: T, newValue: T): void;
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
  return indexToChunkIndex(lod, index);
}

export function indexToChunkIndex(
  lod: SourceDimensionLod,
  index: number
): number {
  return Math.floor(index / lod.chunkSize);
}
