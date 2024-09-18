import { Layer } from "core/layer";
import { Line } from "objects/renderable/line";

export class SingleLineLayer extends Layer {
  constructor() {
    super();

    // TODO: this is just a placeholder that draws a helix
    const radius = 0.3;
    const turns = 5;
    const pointsPerTurn = 100;
    const path: number[] = [];
    const totalPoints = turns * pointsPerTurn;
    const heightIncrement = 0.1;

    for (let i = 0; i < totalPoints; i++) {
      const angle = (i / pointsPerTurn) * 2 * Math.PI;
      const z = radius * Math.cos(angle);
      const y =
        (i / pointsPerTurn) * heightIncrement - (heightIncrement * turns) / 2;
      const x = radius * Math.sin(angle);
      path.push(x, y, z);
    }

    const line = new Line(path);
    this.addObject(line);
  }
}
