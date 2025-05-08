import { RenderableObject } from "../../core/renderable_object";
import { PointsGeometry } from "../geometry/points_geometry";
import { Texture2DArray } from "../textures/texture_2d_array";

type ProceduralMarker = "circle" | "square" | "triangle";
type Marker = ProceduralMarker | Float32Array;
const WIDTH = 256;
const HEIGHT = 256;

export class Points extends RenderableObject {
  private atlas_: Texture2DArray;

  constructor(geometry: PointsGeometry, markerAtlas?: Texture2DArray) {
    super();
    const [minMarker, maxMarker] = geometry.getMarkerRange();
    this.atlas_ =
      markerAtlas ?? makeSpriteAtlas(["circle", "square", "triangle"]);

    if (minMarker < 0 || maxMarker >= this.atlas_.depth) {
      throw new Error(
        `Markers must be in the range [0, ${this.atlas_.depth - 1}] (marker atlas depth)`
      );
    }

    this.geometry = geometry;
    this.programName = "points";

    this.addTexture(this.atlas_);
  }

  public get type() {
    return "Points";
  }
}

const circle = () => {
  const data = new Float32Array(WIDTH * HEIGHT);
  for (let i = 0; i < HEIGHT; i++) {
    for (let j = 0; j < WIDTH; j++) {
      if ((i - HEIGHT / 2) ** 2 + (j - WIDTH / 2) ** 2 < (WIDTH / 2) ** 2) {
        data[i * WIDTH + j] = 1.0;
      }
    }
  }
  return data;
};

const square = () => {
  const data = new Float32Array(WIDTH * HEIGHT);
  data.fill(1.0);
  return data;
};

const triangle = () => {
  const data = new Float32Array(WIDTH * HEIGHT);
  for (let i = 0; i < HEIGHT; i++) {
    for (let j = 0; j < WIDTH; j++) {
      if (j >= (WIDTH - i) / 2 && j <= (WIDTH + i) / 2) {
        data[i * WIDTH + j] = 1.0;
      }
    }
  }
  return data;
};

// TODO: can we do border colors with this method?
// TODO: do we need to soften the edges?
const markerDispatch: Map<ProceduralMarker, () => Float32Array> = new Map([
  ["circle", circle],
  ["square", square],
  ["triangle", triangle],
]);

export const makeSpriteAtlas = (markers: Marker[]) => {
  const images = markers.map((marker) => {
    if (typeof marker === "string") {
      const markerMaker = markerDispatch.get(marker);
      if (!markerMaker) {
        throw new Error(`Unknown marker: ${marker}`);
      }
      const image = markerMaker();
      return image;
    }
    return marker;
  });

  const texture = Texture2DArray.createWithArrays(images, WIDTH, HEIGHT);
  texture.wrapR = "clamp_to_edge";
  texture.wrapS = "clamp_to_edge";
  texture.wrapT = "clamp_to_edge";
  return texture;
};
