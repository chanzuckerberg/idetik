import { vec3 } from "gl-matrix";

import { Geometry } from "core/geometry";

interface PointProperties {
  position: vec3;
  color: vec3;
  size: number;
  // marker is an index into a texture array
  marker: number;
}

export class PointsGeometry extends Geometry {
  constructor(points: PointProperties[]) {
    super();
    this.addAttribute({
      type: "position",
      itemSize: 3,
      offset: 0,
    });
    this.addAttribute({
      type: "color",
      itemSize: 3,
      offset: 3 * Float32Array.BYTES_PER_ELEMENT,
    });
    this.addAttribute({
      type: "size",
      itemSize: 1,
      offset: 6 * Float32Array.BYTES_PER_ELEMENT,
    });
    this.addAttribute({
      type: "marker",
      itemSize: 1,
      offset: 7 * Float32Array.BYTES_PER_ELEMENT,
    });

    this.vertexData_ = new Float32Array(
      points.flatMap((point) => [
        point.position[0],
        point.position[1],
        point.position[2],
        point.color[0],
        point.color[1],
        point.color[2],
        point.size,
        point.marker,
      ])
    );
  }

  public get type() {
    return "PointsGeometry";
  }

  public getMarkerRange() {
    let min = Infinity;
    let max = -Infinity;

    // marker is the 8th element in each vertex, step through with stride of 8
    for (let i = 7; i < this.vertexData.length; i += 8) {
      const marker = this.vertexData[i];
      if (marker < min) min = marker;
      if (marker > max) max = marker;
    }

    return [min, max];
  }
}
