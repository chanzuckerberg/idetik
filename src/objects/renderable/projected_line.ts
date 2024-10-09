import { RenderableObject } from "core/renderable_object";
import { ProjectedLineGoemetry } from "objects/geometry/projected_line_geometry";

type LineParameters = {
  geometry: ProjectedLineGoemetry;
  color: [number, number, number];
  width: number;
};

export class ProjectedLine extends RenderableObject {
  private color_: [number, number, number];
  private width_: number;

  constructor({ geometry, color, width }: LineParameters) {
    super();
    this.geometry = geometry;
    this.color_ = color;
    this.width_ = width;
  }

  public get type() {
    return "ProjectedLine";
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
