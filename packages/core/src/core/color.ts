import { vec3, vec4 } from "gl-matrix";

export type ColorLike = Color | vec3 | vec4;

export type ColorProps = {
  r: number;
  g: number;
  b: number;
  a?: number;
};

export class Color {
  public static readonly RED: Color = new Color({
    r: 1.0,
    g: 0.0,
    b: 0.0,
    a: 1.0,
  });
  public static readonly GREEN: Color = new Color({
    r: 0.0,
    g: 1.0,
    b: 0.0,
    a: 1.0,
  });
  public static readonly BLUE: Color = new Color({
    r: 0.0,
    g: 0.0,
    b: 1.0,
    a: 1.0,
  });
  public static readonly YELLOW: Color = new Color({
    r: 1.0,
    g: 1.0,
    b: 0.0,
    a: 1.0,
  });
  public static readonly MAGENTA: Color = new Color({
    r: 1.0,
    g: 0.0,
    b: 1.0,
    a: 1.0,
  });
  public static readonly CYAN: Color = new Color({
    r: 0.0,
    g: 1.0,
    b: 1.0,
    a: 1.0,
  });
  public static readonly BLACK: Color = new Color({
    r: 0.0,
    g: 0.0,
    b: 0.0,
    a: 1.0,
  });
  public static readonly WHITE: Color = new Color({
    r: 1.0,
    g: 1.0,
    b: 1.0,
    a: 1.0,
  });
  public static readonly TRANSPARENT: Color = new Color({
    r: 0.0,
    g: 0.0,
    b: 0.0,
    a: 0.0,
  });

  // RGBA color values in the range [0, 1]
  private readonly rgba_: readonly [number, number, number, number];

  constructor({ r, g, b, a }: ColorProps) {
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

  public get packed(): number {
    return (
      (Math.round(this.r * 255) << 24) |
      (Math.round(this.g * 255) << 16) |
      (Math.round(this.b * 255) << 8) |
      Math.round(this.a * 255)
    );
  }

  public static from(colorLike: ColorLike): Color {
    if (colorLike instanceof Color) {
      return colorLike;
    }

    if (Array.isArray(colorLike)) {
      return new Color({
        r: colorLike[0],
        g: colorLike[1],
        b: colorLike[2],
        a: colorLike[3],
      });
    }

    throw new Error("Unsupported color format");
  }

  public static fromRgbHex(hex: string): Color {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      throw new Error("Invalid RGB hex, use form '#RRGGBB'");
    }
    return new Color({
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
      a: 1.0,
    });
  }

  private toHexComponent(value: number): string {
    const hex = Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
    return hex.length === 1 ? "0" + hex : hex;
  }
}
