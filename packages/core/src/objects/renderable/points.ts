import { vec3 } from "gl-matrix";

import { Color } from "../../core/color";
import { RenderableObject } from "../../core/renderable_object";
import { Texture2DArray } from "../textures/texture_2d_array";
import { Geometry } from "../../core/geometry";

// TODO: add a border (or "secondary") color to improve contrast against background
export type PointProperties = {
  position: vec3;
  color: Color;
  size: number;
  markerIndex: number;
};

export type PointsProps = {
  points: PointProperties[];
  markerAtlas: Texture2DArray;
};

export class Points extends RenderableObject {
  private atlas_: Texture2DArray;

  constructor({ points, markerAtlas }: PointsProps) {
    super();
    this.programName = "points";
    this.atlas_ = markerAtlas;

    points.forEach((point) => {
      const marker = point.markerIndex;
      if (marker < 0 || marker >= this.atlas_.depth) {
        throw new Error(
          `Markers must be in the range [0, ${this.atlas_.depth - 1}] (number of markers in atlas)`
        );
      }
    });

    const vertexData = points.flatMap((point) => [
      point.position[0],
      point.position[1],
      point.position[2],
      point.color.r,
      point.color.g,
      point.color.b,
      point.color.a,
      point.size,
      point.markerIndex,
    ]);
    const geometry = new Geometry(vertexData, [], "points");

    geometry.addAttribute({
      type: "position",
      itemSize: 3,
      offset: 0,
    });
    geometry.addAttribute({
      type: "color",
      itemSize: 4,
      offset: geometry.strideBytes,
    });
    geometry.addAttribute({
      type: "size",
      itemSize: 1,
      offset: geometry.strideBytes,
    });
    geometry.addAttribute({
      type: "marker",
      itemSize: 1,
      offset: geometry.strideBytes,
    });

    this.geometry = geometry;
    this.setTexture(0, this.atlas_);
  }

  public get type() {
    return "Points";
  }
}
