import { RenderableObject } from "../../core/renderable_object";
import { ProjectedLineGeometry } from "../../objects/geometry/projected_line_geometry";
import { Color, ColorLike } from "../../core/color";
import { Program } from "../../renderers/shaders";

type LineParameters = {
  geometry: ProjectedLineGeometry;
  color: ColorLike;
  width: number;
  taperOffset?: number;
  taperPower?: number;
};

export class ProjectedLine extends RenderableObject {
  private color_: Color;
  private width_: number;
  private taperOffset_: number = 0.5;
  private taperPower_: number = 0.0;

  constructor({
    geometry,
    color,
    width,
    taperOffset,
    taperPower,
  }: LineParameters) {
    super();
    this.program = new Program({ name: "projectedLine" });
    this.geometry = geometry;
    this.color_ = Color.from(color);
    this.width_ = width;
    this.taperOffset_ = taperOffset ?? this.taperOffset_;
    this.taperPower_ = taperPower ?? this.taperPower_;
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

  public get taperOffset() {
    return this.taperOffset_;
  }

  public set taperOffset(value: number) {
    this.taperOffset_ = value;
  }

  public get taperPower() {
    return this.taperPower_;
  }

  public set taperPower(value: number) {
    this.taperPower_ = value;
  }

  public override getUniforms() {
    return {
      LineColor: this.color.rgb,
      LineWidth: this.width,
      TaperOffset: this.taperOffset,
      TaperPower: this.taperPower,
    };
  }
}
