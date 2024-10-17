import { Geometry } from "core/geometry";

export class AxesGeometry extends Geometry {
  constructor(length: number) {
    super();
    this.vertexData_ = new Float32Array([
        0, 0, 0,
        length, 0, 0,
        0, length, 0,
        0, 0, length,
    ]);
    this.indexData_ = new Uint32Array([
        0, 1,
        0, 2,
        0, 3,
    ]);
    this.addAttribute({
      type: "position",
      itemSize: 3,
      offset: 0,
    });
  }
}
