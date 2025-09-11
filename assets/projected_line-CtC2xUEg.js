import { G as Geometry, Q as distance, R as RenderableObject, C as Color } from "./metadata_loaders-CXLkXwNR.js";
class ProjectedLineGeometry extends Geometry {
  // this creates the geometry for a screen-space projected line
  // each point on the input path is split into two vertices
  // these are pushed in opposite directions in screen-space to create width
  // this is done in the vertex shader by moving the vertices along the path normal
  // See:
  //  https://mattdesl.svbtle.com/drawing-lines-is-hard#screenspace-projected-lines_2
  //  https://github.com/spite/THREE.MeshLine
  constructor(path) {
    super();
    this.vertexData_ = this.createVertices(path);
    this.indexData_ = this.createIndex(path.length);
    this.addAttribute({
      type: "position",
      itemSize: 3,
      offset: 0
    });
    this.addAttribute({
      type: "previous_position",
      itemSize: 3,
      offset: 3 * Float32Array.BYTES_PER_ELEMENT
    });
    this.addAttribute({
      type: "next_position",
      itemSize: 3,
      offset: 6 * Float32Array.BYTES_PER_ELEMENT
    });
    this.addAttribute({
      type: "direction",
      itemSize: 1,
      offset: 9 * Float32Array.BYTES_PER_ELEMENT
    });
    this.addAttribute({
      type: "path_proportion",
      itemSize: 1,
      offset: 10 * Float32Array.BYTES_PER_ELEMENT
    });
  }
  createVertices(path) {
    const vertices = new Float32Array(2 * path.length * (3 + 3 + 3 + 1 + 1));
    let c = 0;
    let path_proportion = 0;
    const total_distance = path.reduce((acc, curr, i) => {
      return acc + distance(curr, path[i + 1] ?? curr);
    }, 0);
    for (const i of [...Array(path.length).keys()]) {
      for (const direction of [-1, 1]) {
        const current = path[i];
        vertices[c++] = current[0];
        vertices[c++] = current[1];
        vertices[c++] = current[2];
        const previous = path[i - 1] ?? path[i];
        vertices[c++] = previous[0];
        vertices[c++] = previous[1];
        vertices[c++] = previous[2];
        const next = path[i + 1] ?? path[i];
        vertices[c++] = next[0];
        vertices[c++] = next[1];
        vertices[c++] = next[2];
        vertices[c++] = direction;
        vertices[c++] = path_proportion;
      }
      path_proportion += distance(path[i], path[i + 1] ?? path[i]) / total_distance;
    }
    return vertices;
  }
  createIndex(length) {
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
class ProjectedLine extends RenderableObject {
  color_;
  width_;
  taperOffset_ = 0.5;
  taperPower_ = 0;
  constructor({
    geometry,
    color,
    width,
    taperOffset,
    taperPower
  }) {
    super();
    this.geometry = geometry;
    this.color_ = Color.from(color);
    this.width_ = width;
    this.taperOffset_ = taperOffset ?? this.taperOffset_;
    this.taperPower_ = taperPower ?? this.taperPower_;
    this.programName = "projectedLine";
  }
  get type() {
    return "ProjectedLine";
  }
  get color() {
    return this.color_;
  }
  set color(value) {
    this.color_ = Color.from(value);
  }
  get width() {
    return this.width_;
  }
  set width(value) {
    this.width_ = value;
  }
  get taperOffset() {
    return this.taperOffset_;
  }
  set taperOffset(value) {
    this.taperOffset_ = value;
  }
  get taperPower() {
    return this.taperPower_;
  }
  set taperPower(value) {
    this.taperPower_ = value;
  }
  getUniforms() {
    return {
      LineColor: this.color.rgb,
      LineWidth: this.width,
      TaperOffset: this.taperOffset,
      TaperPower: this.taperPower
    };
  }
}
export {
  ProjectedLineGeometry as P,
  ProjectedLine as a
};
//# sourceMappingURL=projected_line-CtC2xUEg.js.map
