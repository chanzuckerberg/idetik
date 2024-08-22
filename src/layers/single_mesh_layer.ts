import { Layer } from "core/layer";
import { Mesh } from "objects/renderable/mesh";
import { PlaneGeometry } from "objects/geometry/plane_geometry";

export class SingleMeshLayer extends Layer {
  constructor() {
    super();

    const plane = new PlaneGeometry(5, 5, 1, 1);
    const mesh = new Mesh(plane.meshSource);
    this.addObject(mesh);
  }
}
