import { RenderableObject } from "core/renderable_object";
import { LineGeometry } from "objects/geometry/line_geometry";

interface LineParameters {
  geometry: LineGeometry;
  color?: [number, number, number];
  width?: number;
}

export class Line extends RenderableObject {
  private color_: [number, number, number];
  private width_: number;

  constructor({ geometry, color, width }: LineParameters) {
    super();
    this.geometry = geometry;
    this.color_ = color || [0.0, 0.0, 0.0];
    this.width_ = width || 0.5;
  }

  public get type() {
    return "Line";
  }

  public get color() {
    return this.color_;
  }

  public set color(value: [number, number, number]) {
    this.color_ = value;
  }

  public get width() {
    return this.width_;
  }

  public set width(value: number) {
    this.width_ = value;
  }
}
