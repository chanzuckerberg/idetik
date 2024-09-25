import { vec3 } from "gl-matrix";

import { RenderableObject } from "core/renderable_object";

export class Line extends RenderableObject {
  // TODO: support variable color and width along the path
  private color_: vec3 = [1.0, 0.7, 0.0];
  private width_: number = 0.2;

  constructor(path: [number, number, number][]) {
    // path is a list of 3D points [x, y, z]
    super();
    this.geometry.vertexData = this.createVertices(path);
    this.geometry.indexData = this.createIndex(path.length);
    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
    this.geometry.stride = stride;
    this.geometry.addAttribute({
      type: "position",
      itemSize: 3,
      offset: 2 * stride,
    });
    this.geometry.addAttribute({
      type: "nextpos",
      itemSize: 3,
      offset: 4 * stride,
    });
    this.geometry.addAttribute({
      type: "prevpos",
      itemSize: 3,
      offset: 0,
    });
    this.geometry.addAttribute({
      type: "direction",
      itemSize: 1,
      offset: 3 * Float32Array.BYTES_PER_ELEMENT,
    });

    // TODO: this is a hack
    this.color = this.color_;
    this.width = this.width_;
  }

  public get type() {
    return "Line";
  }

  public get color() {
    return this.color_;
  }

  public set color(value: vec3) {
    this.color_ = value;
  }

  public get width() {
    return this.width_;
  }

  public set width(value: number) {
    this.width_ = value;
  }

  private createVertices(path: [number, number, number][]): Float32Array {
    // each point on the path is split into two vertices
    // these are pushed in opposite directions in screen-space in the vertex shader

    // first and last points are duplicated so
    // "current", "previous", and "next" points can be indexed in one buffer
    const length = path.length;
    const vertices = new Float32Array((length + 2) * 4 * 2);
    const positiveOffset = 1.0;
    const negativeOffset = -1.0;

    let c = 0;
    vertices[c++] = path[0][0];
    vertices[c++] = path[0][1];
    vertices[c++] = path[0][2];
    vertices[c++] = positiveOffset;

    vertices[c++] = path[0][0];
    vertices[c++] = path[0][1];
    vertices[c++] = path[0][2];
    vertices[c++] = negativeOffset;

    for (let i = 0; i < length; i++) {
      vertices[c++] = path[i][0];
      vertices[c++] = path[i][1];
      vertices[c++] = path[i][2];
      vertices[c++] = positiveOffset;

      vertices[c++] = path[i][0];
      vertices[c++] = path[i][1];
      vertices[c++] = path[i][2];
      vertices[c++] = negativeOffset;
    }

    vertices[c++] = path[path.length - 1][0];
    vertices[c++] = path[path.length - 1][1];
    vertices[c++] = path[path.length - 1][2];
    vertices[c++] = positiveOffset;

    vertices[c++] = path[path.length - 1][0];
    vertices[c++] = path[path.length - 1][1];
    vertices[c++] = path[path.length - 1][2];
    vertices[c++] = negativeOffset;

    return vertices;
  }

  private createIndex(length: number): Uint32Array {
    // each line segment is a quad split into two triangles
    //       0 ----- 2
    //       |     / |      ^
    //       |    /  |  +direction
    // point a   /   point b
    //       |  /    |  -direction
    //       | /     |      v
    //       1 ----- 3

    const indices = new Uint32Array((length - 1) * 6);
    let c = 0;

    for (let i = 0; i < 2 * length; i += 2) {
      indices[c++] = i + 0;
      indices[c++] = i + 1;
      indices[c++] = i + 2;

      indices[c++] = i + 2;
      indices[c++] = i + 1;
      indices[c++] = i + 3;
    }
    return indices;
  }
}
