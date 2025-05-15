// TODO: move this file out of `textures`
import { Color, ColorLike } from "../../core/color";
import { Texture } from "../../objects/textures/texture";
import { MAX_CHANNELS } from "../../core/constants";
import { Texture2DArray } from "./texture_2d_array";

export type Channel = {
  visible: boolean;
  color: Color;
  contrastLimits: [number, number];
};

export type ChannelProps = {
  visible?: boolean;
  color?: ColorLike;
  contrastLimits?: [number, number];
};

export function validateChannel(
  texture: Texture | null,
  { visible, color, contrastLimits }: ChannelProps
): Channel {
  if (visible === undefined) {
    visible = true;
  }
  if (color === undefined) {
    color = Color.WHITE;
  } else {
    color = Color.from(color);
  }

  if (texture !== null) {
    contrastLimits = validateContrastLimits(contrastLimits, texture);
  } else if (contrastLimits === undefined) {
    console.debug(
      "No texture provided, defaulting channel contrast limits to [0, 1]."
    );
    contrastLimits = [0, 1];
  }
  return {
    visible,
    color,
    contrastLimits,
  };
}

export function validateChannels(
  texture: Texture | null,
  channelProps: ChannelProps[]
): Channel[] {
  if (channelProps.length > MAX_CHANNELS) {
    throw new Error(`Maximum number of channels is ${MAX_CHANNELS}`);
  }

  if (texture?.type === "Texture2DArray") {
    const depth = (texture as Texture2DArray).depth;
    if (channelProps.length !== depth) {
      throw new Error(
        `Number of channels (${channelProps.length}) must match depth of texture (${depth}).`
      );
    }
  }

  return channelProps.map((props) => validateChannel(texture, props));
}

function contrastLimitsFromTexture(texture: Texture): [number, number] {
  if (texture.dataFormat === "rgb" || texture.dataFormat === "rgba") {
    return [0, 1];
  }
  switch (texture.dataType) {
    case "unsigned_byte":
      return [0, 255];
    case "unsigned_short":
      return [0, 65535];
    case "float":
      return [0, 1];
  }
}

function validateContrastLimits(
  contrastLimits: [number, number] | undefined,
  texture: Texture
): [number, number] {
  if (contrastLimits === undefined) {
    return contrastLimitsFromTexture(texture);
  }
  if (contrastLimits[1] <= contrastLimits[0]) {
    throw new Error(
      `Contrast limits must be strictly increasing: ${contrastLimits}.`
    );
  }
  return contrastLimits;
}
