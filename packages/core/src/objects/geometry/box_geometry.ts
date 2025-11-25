import { Geometry } from "../../core/geometry";

type Axis = "x" | "y" | "z";
type Vec3Obj = Record<Axis, number>;

export type BoxGeometryProps = {
  width: number;
  height: number;
  depth: number;
  widthSegments: number;
  heightSegments: number;
  depthSegments: number;
};

export class BoxGeometry extends Geometry {
  constructor({
    width,
    height,
    depth,
    widthSegments,
    heightSegments,
    depthSegments,
  }: BoxGeometryProps) {
    super();

    const vertex: number[] = [];
    const index: number[] = [];

    const wSeg = Math.floor(widthSegments);
    const hSeg = Math.floor(heightSegments);
    const dSeg = Math.floor(depthSegments);

    // prettier-ignore
    {
      this.buildFace("z", "y", "x", -1, -1, depth, height, width, dSeg, hSeg, +1, vertex, index); // +X
      this.buildFace("z", "y", "x", +1, -1, depth, height, width, dSeg, hSeg, -1, vertex, index); // -X
      this.buildFace("x", "z", "y", +1, +1, width, depth, height, wSeg, dSeg, +1, vertex, index); // +Y
      this.buildFace("x", "z", "y", +1, -1, width, depth, height, wSeg, dSeg, -1, vertex, index); // -Y
      this.buildFace("x", "y", "z", +1, -1, width, height, depth, wSeg, hSeg, +1, vertex, index); // +Z
      this.buildFace("x", "y", "z", -1, -1, width, height, depth, wSeg, hSeg, -1, vertex, index); // -Z
    }

    this.vertexData_ = new Float32Array(vertex);
    this.indexData_ = new Uint32Array(index);

    this.addAttribute({
      type: "position",
      itemSize: 3,
      offset: 0,
    });

    this.addAttribute({
      type: "normal",
      itemSize: 3,
      offset: 3 * Float32Array.BYTES_PER_ELEMENT,
    });

    this.addAttribute({
      type: "uv",
      itemSize: 2,
      offset: 6 * Float32Array.BYTES_PER_ELEMENT,
    });
  }

  private buildFace(
    axisU: Axis,
    axisV: Axis,
    axisW: Axis,
    udir: number,
    vdir: number,
    faceWidth: number,
    faceHeight: number,
    faceDepth: number,
    gridX: number,
    gridY: number,
    wdir: number,
    vertex: number[],
    index: number[]
  ) {
    const segmentWidth = faceWidth / gridX;
    const segmentHeight = faceHeight / gridY;

    const widthHalf = faceWidth / 2;
    const heightHalf = faceHeight / 2;
    const depthHalf = (faceDepth / 2) * wdir;

    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;

    const vertexPosition = vertex.length / 8;

    for (let iy = 0; iy < gridY1; iy++) {
      const vy = -heightHalf + iy * segmentHeight;
      for (let ix = 0; ix < gridX1; ix++) {
        const vx = -widthHalf + ix * segmentWidth;

        const position: Vec3Obj = { x: 0, y: 0, z: 0 };
        position[axisU] = vx * udir;
        position[axisV] = vy * vdir;
        position[axisW] = depthHalf;

        const normal: Vec3Obj = { x: 0, y: 0, z: 0 };
        normal[axisW] = wdir;

        const u = ix / gridX;
        const v = 1 - iy / gridY;

        vertex.push(
          position.x,
          position.y,
          position.z,
          normal.x,
          normal.y,
          normal.z,
          u,
          v
        );
      }
    }

    for (let iy = 0; iy < gridY; iy++) {
      for (let ix = 0; ix < gridX; ix++) {
        const a = vertexPosition + ix + gridX1 * iy;
        const b = vertexPosition + ix + gridX1 * (iy + 1);
        const c = vertexPosition + (ix + 1) + gridX1 * (iy + 1);
        const d = vertexPosition + (ix + 1) + gridX1 * iy;
        if (wdir === 1) {
          index.push(a, b, d, b, c, d);
        } else {
          index.push(a, d, b, b, d, c);
        }
      }
    }
  }
}
