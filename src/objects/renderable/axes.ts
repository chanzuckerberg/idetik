import { RenderableObject } from "core/renderable_object";
import { AxesGeometry } from "objects/geometry/axes_geometry";

export class Axes extends RenderableObject {
  constructor(length: number) {
    super();
    this.geometry = new AxesGeometry(length);
  }

  public get color() {
    return [1, 0, 0];
  }

  public get type() {
    return "Axes";
  }
}
