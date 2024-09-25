import { Layer } from "core/layer";
import { Mesh } from "objects/renderable/mesh";
import { PlaneGeometry } from "objects/geometry/plane_geometry";
import { Texture2D } from "@/objects/textures/texture_2d";

export class SingleMeshLayer extends Layer {
  private texture_ = new Texture2D("./texture_test.png");

  constructor() {
    super();
    this.state_ = "loading";
    const plane = new PlaneGeometry(600, 600, 1, 1);
    const mesh = new Mesh(plane, this.texture_);

    // This code is temporary. I'd like to implement a function that layers
    // can override to handle viewport resizing. This is where an event
    // propagation helper would be useful. Ideally, it would capture the
    // viewport's dimensions, not the window's, allowing each individual layer
    // to respond accordingly.
    mesh.transform.translate([1, 0, 0], window.innerWidth >> 1);
    mesh.transform.translate([0, 1, 0], window.innerHeight >> 1);

    this.addObject(mesh);
  }

  public update(): void {
    if (this.texture_.loaded) {
      this.state_ = "ready";
    }
  }
}
