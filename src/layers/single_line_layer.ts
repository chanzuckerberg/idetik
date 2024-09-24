import { Layer } from "core/layer";
import { Line } from "objects/renderable/line";

export class SingleLineLayer extends Layer {
  constructor(
    path: [number, number, number][],
    color: [number, number, number] = [1.0, 0.7, 0.0],
    width: number = 0.2
  ) {
    super();

    // TODO: add color and width to the Line constructor?
    const line = new Line(path);
    line.color = color;
    line.width = width;
    this.addObject(line);

    this.state_ = "ready";
  }

  public update(): void {}
}
