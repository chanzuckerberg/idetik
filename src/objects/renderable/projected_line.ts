import { vec3 } from "gl-matrix";
import { RenderableObject } from "core/renderable_object";
import { ProjectedLineGeometry } from "objects/geometry/projected_line_geometry";

interface LineParameters {
  geometry: ProjectedLineGeometry;
  color: vec3;
  width: number;
}

export class ProjectedLine extends RenderableObject {
  private color_: vec3;
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

  public set color(value: vec3) {
    this.color_ = value;
  }

  public get width() {
    return this.width_;
  }

  public set width(value: number) {
    this.width_ = value;
  }
}
