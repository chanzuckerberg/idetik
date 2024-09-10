export interface Slice {
    dimension: string;
    start: number;
    stop: number;
};

export type Region = Array<Slice>;

export interface DataLoadInput {
    region: Region;
    renderSize?: [number, number];
};

export interface VolumeChunk<ArrayType> {
    region: Region;
    // tfm: Transform;
    data: ArrayType;
    shape: Array<number>;
    stride: Array<number>;
};