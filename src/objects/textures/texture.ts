import { Node } from "core/node";

export type TextureFilter = "nearest" | "linear";

export type TextureWrapMode = "repeat" | "clamp_to_edge";

export type TextureDataFormat = "rgb" | "rgba" | "red_integer";

export type TextureDataType = "unsigned_byte" | "unsigned_short";

export type TextureUnpackRowAlignment = 1 | 2 | 4 | 8;

export function isTextureUnpackRowAlignment(
  value: number
): value is TextureUnpackRowAlignment {
  return value === 1 || value === 2 || value === 4 || value === 8;
}

export abstract class Texture extends Node {
  public dataFormat: TextureDataFormat = "rgba";
  public dataType: TextureDataType = "unsigned_byte";
  public maxFilter: TextureFilter = "nearest";
  public minFilter: TextureFilter = "nearest";
  public mipmapLevels = 1;
  public unpackAlignment: TextureUnpackRowAlignment = 4;
  public unpackRowLength = 0;
  public wrapR: TextureWrapMode = "repeat";
  public wrapS: TextureWrapMode = "repeat";
  public wrapT: TextureWrapMode = "repeat";

  public abstract get width(): number;
  public abstract get height(): number;
  public abstract get data(): TexImageSource | ArrayBufferView | null;

  public get type() {
    return "Texture";
  }
}
