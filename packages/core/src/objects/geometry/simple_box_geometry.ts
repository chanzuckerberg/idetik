import { Geometry } from "../../core/geometry";

export class SimpleBoxGeometry extends Geometry {
  constructor() {
    super();

    // Raw vertex data: position (x,y,z), normal (x,y,z), uv (u,v)
    // 8 vertices * 8 floats per vertex = 64 floats total
    // prettier-ignore
    const vertices = new Float32Array([
      // Front face (positive Z)
      -0.5, -0.5,  0.5,  0,  0,  1,  0, 0, // bottom-left
       0.5, -0.5,  0.5,  0,  0,  1,  1, 0, // bottom-right
       0.5,  0.5,  0.5,  0,  0,  1,  1, 1, // top-right
      -0.5,  0.5,  0.5,  0,  0,  1,  0, 1, // top-left

      // Back face (negative Z)
       0.5, -0.5, -0.5,  0,  0, -1,  0, 0, // bottom-left
      -0.5, -0.5, -0.5,  0,  0, -1,  1, 0, // bottom-right
      -0.5,  0.5, -0.5,  0,  0, -1,  1, 1, // top-right
       0.5,  0.5, -0.5,  0,  0, -1,  0, 1, // top-left

      // Left face (negative X)
      -0.5, -0.5, -0.5, -1,  0,  0,  0, 0, // bottom-left
      -0.5, -0.5,  0.5, -1,  0,  0,  1, 0, // bottom-right
      -0.5,  0.5,  0.5, -1,  0,  0,  1, 1, // top-right
      -0.5,  0.5, -0.5, -1,  0,  0,  0, 1, // top-left

      // Right face (positive X)
       0.5, -0.5,  0.5,  1,  0,  0,  0, 0, // bottom-left
       0.5, -0.5, -0.5,  1,  0,  0,  1, 0, // bottom-right
       0.5,  0.5, -0.5,  1,  0,  0,  1, 1, // top-right
       0.5,  0.5,  0.5,  1,  0,  0,  0, 1, // top-left

      // Top face (positive Y)
      -0.5,  0.5,  0.5,  0,  1,  0,  0, 0, // bottom-left
       0.5,  0.5,  0.5,  0,  1,  0,  1, 0, // bottom-right
       0.5,  0.5, -0.5,  0,  1,  0,  1, 1, // top-right
      -0.5,  0.5, -0.5,  0,  1,  0,  0, 1, // top-left

      // Bottom face (negative Y)
      -0.5, -0.5, -0.5,  0, -1,  0,  0, 0, // bottom-left
       0.5, -0.5, -0.5,  0, -1,  0,  1, 0, // bottom-right
       0.5, -0.5,  0.5,  0, -1,  0,  1, 1, // top-right
      -0.5, -0.5,  0.5,  0, -1,  0,  0, 1, // top-left
    ]);

    // Indices for triangles (counter-clockwise winding for front faces)
    // prettier-ignore
    const indices = new Uint32Array([
      // Front face
      0,  1,  2,    0,  2,  3,
      // Back face
      4,  5,  6,    4,  6,  7,
      // Left face
      8,  9, 10,    8, 10, 11,
      // Right face
      12, 13, 14,   12, 14, 15,
      // Top face
      16, 17, 18,   16, 18, 19,
      // Bottom face
      20, 21, 22,   20, 22, 23
    ]);

    this.vertexData_ = vertices;
    this.indexData_ = indices;

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
}
