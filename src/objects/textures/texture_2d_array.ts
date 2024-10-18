import { Texture } from "objects/textures/texture";

export class Texture2DArray extends Texture {
    private data_: ArrayBufferView;
    private readonly width_: number;
    private readonly height_: number;
    private readonly layerByteLength_: number;

    constructor(data: ArrayBufferView, width: number, height: number, layerByteLength: number) {
        super();

        if (layerByteLength < data.byteLength) {
            // TODO: not enought for a single layer
        }

        if (data.byteLength % layerByteLength !== 0) {
            // TODO: throw an error offset is not divisible
        }

        this.data_ = data;
        this.width_ = width;
        this.height_ = height;
        this.layerByteLength_ = layerByteLength;
    }

    public get type() {
        return "Texture2DArray";
    }

    public set data(data: ArrayBufferView) {
        this.data_ = data;
        this.needsUpdate = true;
    }

    public get data() {
        return this.data_;
    }

    public get width() {
        return this.width_;
    }

    public get height() {
        return this.height_;
    }

    public get layerOffset() {
        return this.layerByteLength_;
    }
}