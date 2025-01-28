import { Texture } from "objects/textures/texture";

export type ChannelProps = {
  contrastLimits?: [number, number];
};

export type Channel = {
  contrastLimits: [number, number];
};

export function validateChannel(
  texture: Texture,
  { contrastLimits }: ChannelProps
): Channel {
  return {
    contrastLimits: validateContrastLimits(contrastLimits, texture),
  };
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
