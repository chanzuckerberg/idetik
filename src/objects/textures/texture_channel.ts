import { Texture } from "objects/textures/texture";

export type TextureChannelProps = {
  contrastLimits?: [number, number];
};

export type TextureChannel = {
  contrastLimits: [number, number];
};

export function validateTextureChannel(
  texture: Texture,
  { contrastLimits }: TextureChannelProps
): TextureChannel {
  return {
    contrastLimits: validateContrastLimits(texture, contrastLimits),
  };
}

function validateContrastLimits(
  texture: Texture,
  contrastLimits: [number, number] | undefined
): [number, number] {
  if (contrastLimits !== undefined) {
    if (contrastLimits[1] <= contrastLimits[0]) {
      throw new Error(
        `Contrast limits must be strictly increasing: ${contrastLimits}.`
      );
    }
    return contrastLimits;
  }
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
