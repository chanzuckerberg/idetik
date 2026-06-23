import { RenderableObject } from "../../core/renderable_object";
import { ProjectedLineGeometry } from "../../objects/geometry/projected_line_geometry";
import { Color, ColorLike } from "../../math/color";

type LineParameters = {
  geometry: ProjectedLineGeometry;
  color: ColorLike;
  width: number;
};

export class ProjectedLine extends RenderableObject {
  private color_: Color;
  private width_: number;

  constructor({ geometry, color, width }: LineParameters) {
    super();
    this.geometry = geometry;
    this.color_ = Color.from(color);
    this.width_ = width;
    this.programName = "projectedLine";
  }

  public get type() {
    return "ProjectedLine";
  }

  public get color(): Color {
    return this.color_;
  }

  public set color(value: ColorLike) {
    this.color_ = Color.from(value);
  }

  public get width() {
    return this.width_;
  }

  public set width(value: number) {
    this.width_ = value;
  }

  public override getUniforms() {
    return {
      u_lineColor: this.color.rgb,
      u_lineWidth: this.width,
    };
  }
}
