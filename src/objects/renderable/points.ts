import { vec3 } from "gl-matrix";

import { Color, ColorLike } from "../../math/color";
import { RenderableObject } from "../../core/renderable_object";
import { Texture2DArray } from "../textures/texture_2d_array";
import { Geometry } from "../../core/geometry";

type Marker = "circle" | "square" | "triangle";

const MARKER_INDEX: Record<Marker, number> = {
  circle: 0,
  square: 1,
  triangle: 2,
};

// TODO: add a border (or "secondary") color to improve contrast against background
type PointProperties = {
  position: vec3;
  color: ColorLike;
  size: number;
  marker: Marker;
};

export class Points extends RenderableObject {
  constructor(points: PointProperties[]) {
    super();
    this.programName = "points";

    const vertexData = points.flatMap((point) => {
      const color = Color.from(point.color);
      return [
        point.position[0],
        point.position[1],
        point.position[2],
        color.r,
        color.g,
        color.b,
        color.a,
        point.size,
        MARKER_INDEX[point.marker],
      ];
    });
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
    this.setTexture(0, getMarkerAtlas());
  }

  public get type() {
    return "Points";
  }
}

let markerAtlas: Texture2DArray | undefined;

// The marker atlas is a fixed set of sprites shared by all Points instances.
// Each marker in `Marker` maps to a slice in the atlas (see `MARKER_INDEX`).
function getMarkerAtlas(): Texture2DArray {
  if (!markerAtlas) {
    markerAtlas = createMarkerAtlas();
  }
  return markerAtlas;
}

function createMarkerAtlas(): Texture2DArray {
  const square = (size: number) => {
    const data = new Float32Array(size * size);
    data.fill(1.0);
    return data;
  };

  const circle = (size: number) => {
    const data = new Float32Array(size * size);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if ((i - size / 2) ** 2 + (j - size / 2) ** 2 < (size / 2) ** 2) {
          data[i * size + j] = 1.0;
        }
      }
    }
    return data;
  };

  const triangle = (size: number) => {
    const data = new Float32Array(size * size);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (j >= (size - i) / 2 && j <= (size + i) / 2) {
          data[i * size + j] = 1.0;
        }
      }
    }
    return data;
  };

  const SPRITE_SIZE = 256;
  const pixelsPerMarkerSprite = SPRITE_SIZE * SPRITE_SIZE;
  const sprites: Record<Marker, Float32Array> = {
    circle: circle(SPRITE_SIZE),
    square: square(SPRITE_SIZE),
    triangle: triangle(SPRITE_SIZE),
  };

  const numMarkers = Object.keys(sprites).length;
  const data = new Float32Array(numMarkers * pixelsPerMarkerSprite);
  for (const [marker, sprite] of Object.entries(sprites) as [
    Marker,
    Float32Array,
  ][]) {
    data.set(sprite, MARKER_INDEX[marker] * pixelsPerMarkerSprite);
  }

  // TODO: this uses f32 values, which are not (by default) filterable in WebGL2
  // to enable this, we can check/add OES_texture_float_linear.
  // we also don't need the precision of f32 for this so I'd like to use an R8
  // texture instead, but our Texture class does not yet support it.
  const texture = new Texture2DArray(data, SPRITE_SIZE, SPRITE_SIZE);
  texture.wrapR = "clamp_to_edge";
  texture.wrapS = "clamp_to_edge";
  texture.wrapT = "clamp_to_edge";
  return texture;
}
