import { Layer } from "core/layer";
import { ProjectedLine } from "objects/renderable/projected_line";
import { ProjectedLineGoemetry } from "objects/geometry/projected_line_geometry";

interface LineParameters {
  path: [number, number, number][];
  color: [number, number, number];
  width: number;
}

export class ProjectedLineLayer extends Layer {
  constructor(lines: LineParameters[] = []) {
    super();
    lines.forEach(this.addLine);
    this.setState("ready");
  }

  public addLine(line: LineParameters) {
    const { path, color, width } = line;
    const geometry = new ProjectedLineGoemetry(path);
    this.addObject(new ProjectedLine({ geometry, color, width }));
  }

  public update(): void {}
}
