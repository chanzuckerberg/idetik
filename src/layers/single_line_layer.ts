import { Layer } from "core/layer";
import { Line } from "objects/renderable/line";
import { LineGeometry } from "objects/geometry/line_geometry";

interface LineLayerParameters {
  path: [number, number, number][];
  color?: [number, number, number];
  width?: number;
}

export class LineLayer extends Layer {
  constructor(lines: LineLayerParameters[] = []) {
    super();
    lines.forEach(this.addLine);
    this.state_ = "ready";
  }

  public addLine(line: LineLayerParameters) {
    const { path, color, width } = line;
    const geometry = new LineGeometry(path);
    this.addObject(new Line({ geometry, color, width }));
  }

  public update(): void {}
}
