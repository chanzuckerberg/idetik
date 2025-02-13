import { RenderableObject } from "core/renderable_object";
import { Geometry } from "core/geometry";
import { Texture } from "objects/textures/texture";
import { MAX_CHANNELS } from "../../constants";
import { ChannelProps } from "../textures/channel";

type UniformValues = {
    "Visible[0]": boolean[];
    "Color[0]": number[];
    "ValueOffset[0]": number[];
    "ValueScale[0]": number[];
};

export class ImageRenderable extends RenderableObject {
    private channels_: Required<ChannelProps>[];

    constructor(
        geometry: Geometry | null,
        texture: Texture | null = null,
        channels: ChannelProps[] = []
    ) {
        super();

        if (geometry) {
            this.geometry = geometry;
        }

        if (texture) {
            this.addTexture(texture);
        }

        if (channels.length > MAX_CHANNELS) {
            throw new Error(`Maximum number of channels is ${MAX_CHANNELS}`);
        }
        // Convert to Required<ChannelProps> with defaults
        this.channels_ = channels.map(channel => ({
            visible: channel.visible ?? false,
            color: channel.color ?? [1, 1, 1],
            contrastLimits: channel.contrastLimits ?? [0, 255],
        }));
    }

    public get type() {
        return "ImageRenderable";
    }

    public addTexture(texture: Texture) {
        super.addTexture(texture);
        this.setProgramName();
    }

    public setChannelProperty<K extends keyof ChannelProps>(
        channelIndex: number,
        property: K,
        value: Required<ChannelProps>[K]
    ): void {
        if (channelIndex < 0 || channelIndex >= this.channels_.length) {
            throw new Error(`Invalid channel index: ${channelIndex}`);
        }
        this.channels_[channelIndex][property] = value;
    }

    public override getUniforms(): UniformValues {
        const visible: boolean[] = [];
        const color: number[] = [];
        const valueOffset: number[] = [];
        const valueScale: number[] = [];

        // Fill arrays up to MAX_CHANNELS
        for (let i = 0; i < MAX_CHANNELS; i++) {
            if (i < this.channels_.length) {
                const channel = this.channels_[i];
                visible.push(channel.visible);
                color.push(...channel.color);
                valueOffset.push(-channel.contrastLimits[0]);
                valueScale.push(1 / (channel.contrastLimits[1] - channel.contrastLimits[0]));
            } else {
                // Pad with defaults
                visible.push(false);
                color.push(0, 0, 0);
                valueOffset.push(0);
                valueScale.push(1);
            }
        }

        return {
            "Visible[0]": visible,
            "Color[0]": color,
            "ValueOffset[0]": valueOffset,
            "ValueScale[0]": valueScale,
        };
    }

    private setProgramName() {
        const texture = this.textures[0];
        if (!texture) {
            throw new Error("un-textured image not implemented");
        } else if (texture.type == "DataTexture2D") {
            this.programName =
                texture.dataType == "float" ? "floatImage" : "uintImage";
        } else if (texture.type == "Texture2DArray") {
            this.programName =
                texture.dataType == "float" ? "floatImageArray" : "uintImageArray";
        }
    }
}