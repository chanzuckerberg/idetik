import { ProjectedLineGeometry } from "objects/geometry/projected_line_geometry";
import { Layer } from "core/layer";
import { ProjectedLine } from "objects/renderable/projected_line";

export class AxesLayer extends Layer {
  constructor(params: { length: number; width: number }) {
    super();
    const { length, width } = params;
    const x = new ProjectedLineGeometry([
      [0, 0, 0],
      [length, 0, 0],
    ]);
    const y = new ProjectedLineGeometry([
      [0, 0, 0],
      [0, length, 0],
    ]);
    const z = new ProjectedLineGeometry([
      [0, 0, 0],
      [0, 0, length],
    ]);
    this.addObject(
      new ProjectedLine({
        geometry: x,
        color: [1, 0, 0],
        width: width,
      })
    );
    this.addObject(
      new ProjectedLine({
        geometry: y,
        color: [0, 1, 0],
        width: width,
      })
    );
    this.addObject(
      new ProjectedLine({
        geometry: z,
        color: [0, 0, 1],
        width: width,
      })
    );
    this.setState("ready");
  }

  public update(): void {}
}
