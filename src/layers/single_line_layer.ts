import { Layer } from "core/layer";
import { Line } from "objects/renderable/line";

export class SingleLineLayer extends Layer {
  constructor() {
    super();

    // TODO: this is just a placeholder that draws a helix
    const radius = 1.0;
    const turns = 3;
    const pointsPerTurn = 100;
    let path: number[] = [];
    const totalPoints = turns * pointsPerTurn;
    const heightIncrement = 1.5;

    for (let i = 0; i < totalPoints; i++) {
      const angle = (i / pointsPerTurn) * 2 * Math.PI;
      const z = radius * Math.cos(angle) - 5.0;
      const y =
        (i / pointsPerTurn) * heightIncrement - (heightIncrement * turns) / 2;
      const x = radius * Math.sin(angle);
      path.push(x, y, z);
    }

    let line = new Line(path);
    this.addObject(line);

    path = [
      0.0, -2.0, -5.0,
      0.0, 2.0, -5.0,
    ];

    line = new Line(path);
    line.color = [0.0, 1.0, 0.0];
    this.addObject(line);
  }

  public update(): void {
    this.state_ = "ready";
  }
}
