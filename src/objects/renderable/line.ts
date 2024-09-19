import { vec3 } from "gl-matrix";

import { RenderableObject } from "core/renderable_object";
import { Geometry } from "objects/geometry";

export class Line extends RenderableObject {
  // TODO: this geometry should be replaced after refactoring
  private geometry_: Geometry;

  // TODO: support variable color and width along the path
  private color_: vec3 = [1.0, 0.7, 0.0];
  private width_: number = 0.05;

  constructor(path: number[]) {
    super();
    const geometry = {
      vertices: this.createVertices(path),
      index: this.createIndex(path.length / 3),
    };

    this.geometry_ = geometry;
  }

  public get type() {
    return "Line";
  }

  public get geometry() {
    return this.geometry_;
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

  private createVertices(path: number[]): Float32Array {
    // each point on the path is split into two vertices
    // these are pushed in opposite directions in screen-space in the vertex shader

    // first and last points are duplicated so
    // "current", "previous", and "next" points can be indexed in one buffer
    const length = path.length / 3;
    const vertices = new Float32Array((length + 2) * 4 * 2);
    const positiveOffset = 1.0;
    const negativeOffset = -1.0;

    let c = 0;
    vertices[c++] = path[0];
    vertices[c++] = path[1];
    vertices[c++] = path[2];
    vertices[c++] = positiveOffset;

    vertices[c++] = path[0];
    vertices[c++] = path[1];
    vertices[c++] = path[2];
    vertices[c++] = negativeOffset;

    for (let i = 0; i < length; i++) {
      vertices[c++] = path[i * 3 + 0];
      vertices[c++] = path[i * 3 + 1];
      vertices[c++] = path[i * 3 + 2];
      vertices[c++] = positiveOffset;

      vertices[c++] = path[i * 3 + 0];
      vertices[c++] = path[i * 3 + 1];
      vertices[c++] = path[i * 3 + 2];
      vertices[c++] = negativeOffset;
    }

    vertices[c++] = path[path.length - 3];
    vertices[c++] = path[path.length - 2];
    vertices[c++] = path[path.length - 1];
    vertices[c++] = positiveOffset;

    vertices[c++] = path[path.length - 3];
    vertices[c++] = path[path.length - 2];
    vertices[c++] = path[path.length - 1];
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
