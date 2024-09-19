import { MeshSource } from "../../data/mesh_source";

export class PlaneGeometry {
  private vertices_: number[] = [];
  private indices_: number[] = [];
  private normals_: number[] = [];
  private uvs_: number[] = [];
  private meshSource_: MeshSource | null = null;

  constructor(
    width: number,
    height: number,
    widthSegments: number,
    heightSegments: number
  ) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const gridX = widthSegments;
    const gridY = heightSegments;
    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;
    const segmentW = width / gridX;
    const segmentH = height / gridY;

    for (let iy = 0; iy < gridY1; ++iy) {
      const y = iy * segmentH - halfHeight;
      for (let ix = 0; ix < gridX1; ++ix) {
        const x = ix * segmentW - halfWidth;
        const u = ix / gridX;
        const v = 1 - iy / gridY;

        // 'z = -5' is temporary until we add a transform to renderable objects
        // which will allow us to control the camera position
        this.vertices_.push(x, -y, -5);
        this.normals_.push(0, 1, 0);
        this.uvs_.push(u, v);
      }
    }

    for (let iy = 0; iy < gridY; ++iy) {
      for (let ix = 0; ix < gridX; ++ix) {
        const a = ix + gridX1 * iy;
        const b = ix + gridX1 * (iy + 1);
        const c = ix + 1 + gridX1 * (iy + 1);
        const d = ix + 1 + gridX1 * iy;

        this.indices_.push(a, b, d);
        this.indices_.push(b, c, d);
      }
    }
  }

  public get meshSource() {
    if (!this.meshSource_) {
      this.meshSource_ = new MeshSource();
      this.meshSource_.setAttribute("vertices", this.vertices_, 3);
      this.meshSource_.setAttribute("normals", this.normals_, 3);
      this.meshSource_.setAttribute("uvs", this.uvs_, 2);
      this.meshSource_.setIndex(this.indices_);
    }
    return this.meshSource_;
  }
}
