import { Layer } from "@/core/layer";
import { Mesh } from "@/objects/renderable/mesh";

export class SingleMeshLayer extends Layer {
  constructor() {
    super();

    const mesh = new Mesh();
    this.addObject(mesh);
  }
}
