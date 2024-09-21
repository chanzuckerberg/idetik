import { Layer } from "core/layer";
import { Mesh } from "objects/renderable/mesh";
import { PlaneGeometry } from "objects/geometry/plane_geometry";
import { Texture2D } from "@/objects/textures/texture_2d";

export class SingleMeshLayer extends Layer {
  private texture_ = new Texture2D("/texture_test.png");

  constructor() {
    super();
    this.state_ = "loading";

    const plane = new PlaneGeometry(3, 3, 1, 1);
    this.addObject(new Mesh(plane, this.texture_));
  }

  public update(): void {
    if (this.texture_.loaded) {
      this.state_ = "ready";
    }
  }
}
