// TODO: move this file out of `textures`
import { Color, type ColorLike } from "../../core/color";
import { MAX_CHANNELS } from "../../core/constants";
import {
  type Texture,
  textureDefaultValueRange,
} from "../../objects/textures/texture";
import { Logger } from "../../utilities/logger";
import type { Texture2DArray } from "./texture_2d_array";

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

/** Layer that exposes channel controls. */
export interface ChannelsEnabled {
  channelProps: ChannelProps[] | undefined;
  setChannelProps(channelProps: ChannelProps[]): void;
  resetChannelProps(): void;
  addChannelChangeCallback(callback: () => void): void;
  removeChannelChangeCallback(callback: () => void): void;
}

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
    Logger.debug(
      "Channel",
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

/**
 * returns the channel indices where visibility is not explicitly "false" (i.e: if no visibility is set, then we consider it as "true")
 * if all channels are visible, returns "undefined" to force load of all channels;
 * otherwise returns an array of visible channel indices only
 */
export function visibleChannelIndices(
  channelProps: ChannelProps[]
): number[] | undefined {
  const visible = channelProps
    .map((p, i) => (p.visible !== false ? i : -1))
    .filter((i) => i >= 0);
  if (visible.length === channelProps.length) return undefined;
  return visible;
}

/**
 * Expands the current visible channels to include channels that have been switched as "visible".
 * Channels are only added, never removed
 * Returns undefined (load all) once all channels have been seen.
 */
export function expandVisibleChannels(
  current: number | number[] | undefined,
  channelProps: ChannelProps[]
): number[] | undefined {
  if (current === undefined) return undefined;

  const currentArray = typeof current === "number" ? [current] : current;
  if (currentArray.length === channelProps.length) return undefined;

  const newlyVisible = channelProps
    .map((p, i) => (p.visible !== false ? i : -1))
    .filter((i) => i >= 0 && !currentArray.includes(i));
  if (newlyVisible.length === 0) return currentArray;

  const expanded = [...currentArray, ...newlyVisible].sort((a, b) => a - b);
  if (expanded.length === channelProps.length) return undefined;

  return expanded;
}

function validateContrastLimits(
  contrastLimits: [number, number] | undefined,
  texture: Texture
): [number, number] {
  if (contrastLimits === undefined) {
    return textureDefaultValueRange(texture);
  }
  if (contrastLimits[1] <= contrastLimits[0]) {
    throw new Error(
      `Contrast limits must be strictly increasing: ${contrastLimits}.`
    );
  }
  return contrastLimits;
}
