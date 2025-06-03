import { vec3, vec4 } from "gl-matrix";

export type ColorLike = Color | vec3 | vec4;

export class Color {
  // RGBA color values in the range [0, 1]
  private readonly rgba_: readonly [number, number, number, number];

  constructor(r: number, g: number, b: number, a?: number) {
    if (r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1) {
      throw new Error("RGB values must be in the range [0, 1]");
    }
    if (a !== undefined && (a < 0 || a > 1)) {
      throw new Error("Alpha value must be in the range [0, 1]");
    }
    this.rgba_ = [r, g, b, a ?? 1.0];
  }

  public get rgb(): [number, number, number] {
    return [this.rgba_[0], this.rgba_[1], this.rgba_[2]];
  }

  public get rgba(): readonly [number, number, number, number] {
    return this.rgba_;
  }

  public get r(): number {
    return this.rgba_[0];
  }

  public get g(): number {
    return this.rgba_[1];
  }

  public get b(): number {
    return this.rgba_[2];
  }

  public get a(): number {
    return this.rgba_[3];
  }

  public get rgbHex(): string {
    return `#${this.toHexComponent(this.r)}${this.toHexComponent(this.g)}${this.toHexComponent(this.b)}`;
  }

  public static from(colorLike: ColorLike): Color {
    if (colorLike instanceof Color) {
      return colorLike;
    }

    if (Array.isArray(colorLike)) {
      return new Color(colorLike[0], colorLike[1], colorLike[2], colorLike[3]);
    }

    throw new Error("Unsupported color format");
  }

  public static fromRgbHex(hex: string): Color {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      throw new Error("Invalid RGB hex, use form '#RRGGBB'");
    }
    return new Color(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
      1.0
    );
  }

  public static RED: Color = new Color(1.0, 0.0, 0.0);
  public static GREEN: Color = new Color(0.0, 1.0, 0.0);
  public static BLUE: Color = new Color(0.0, 0.0, 1.0);
  public static BLACK: Color = new Color(0.0, 0.0, 0.0);
  public static WHITE: Color = new Color(1.0, 1.0, 1.0);

  private toHexComponent(value: number): string {
    const hex = Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
    return hex.length === 1 ? "0" + hex : hex;
  }
}
