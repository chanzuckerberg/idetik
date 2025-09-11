import "./modulepreload-polyfill-DaKOjhqt.js";
import { R as RenderableObject, G as Geometry, C as Color, I as Idetik, L as Layer } from "./metadata_loaders-CXLkXwNR.js";
import { O as OmeZarrImageSource, a as OrthographicCamera, T as Texture2DArray } from "./image_source-BemCU8_Z.js";
import { P as PanZoomControls } from "./controls-C_nkNJ-y.js";
import { I as ImageSeriesLayer } from "./image_series_layer-xl760NUg.js";
class Points extends RenderableObject {
  atlas_;
  constructor(points, markerAtlas) {
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
      point.markerIndex
    ]);
    const geometry = new Geometry(vertexData, [], "points");
    geometry.addAttribute({
      type: "position",
      itemSize: 3,
      offset: 0
    });
    geometry.addAttribute({
      type: "color",
      itemSize: 4,
      offset: geometry.stride
    });
    geometry.addAttribute({
      type: "size",
      itemSize: 1,
      offset: geometry.stride
    });
    geometry.addAttribute({
      type: "marker",
      itemSize: 1,
      offset: geometry.stride
    });
    this.geometry = geometry;
    this.setTexture(0, this.atlas_);
  }
  get type() {
    return "Points";
  }
}
const baseUrl = "https://files.cryoetdataportal.cziscience.com/10445/TS_100_3/Reconstructions/VoxelSpacing4.990";
const imageUrl = `${baseUrl}/Tomograms/100/TS_100_3.zarr`;
const ribosomesUrl = `${baseUrl}/Annotations/104/cytosolic_ribosome-1.0_point.ndjson`;
const ferritinUrl = `${baseUrl}/Annotations/101/ferritin_complex-1.0_point.ndjson`;
const virusLikeUrl = `${baseUrl}/Annotations/106/pp7_vlp-1.0_point.ndjson`;
const IMAGE_SCALE_0 = 4.99;
const IMAGE_SCALE_2 = 19.96;
const INITIAL_Z_POSITION = 918.16;
const fetchPositionsFromNDJson = async (url) => {
  return await fetch(url).then(async (response) => {
    const allPoints = await response.text();
    const points = allPoints.split("\n").filter((line) => line.length > 0).map((line) => JSON.parse(line));
    return points.map((point) => {
      let { x, y, z } = point["location"];
      x = x * IMAGE_SCALE_0;
      y = y * IMAGE_SCALE_0;
      z = z * IMAGE_SCALE_0;
      return [x, y, z];
    });
  });
};
const ribosomeLocations = await fetchPositionsFromNDJson(ribosomesUrl);
const ferritinLocations = await fetchPositionsFromNDJson(ferritinUrl);
const virusLikeLocations = await fetchPositionsFromNDJson(virusLikeUrl);
class Particles extends Layer {
  type = "Particles";
  points_ = [];
  color_;
  markerIndex_ = 0;
  static markerAtlas_;
  needsUpdate_ = true;
  depth_ = 0;
  constructor(points, color, marker) {
    super();
    this.setState("initialized");
    this.points_ = points;
    this.color_ = Color.from(color);
    this.markerIndex_ = marker === "circle" ? 0 : marker === "square" ? 1 : 2;
    this.refreshPointsRenderable();
    this.setState("ready");
  }
  setDepth(z) {
    this.depth_ = z;
    this.needsUpdate_ = true;
  }
  update() {
    if (!this.needsUpdate_) {
      return;
    }
    this.refreshPointsRenderable();
    this.needsUpdate_ = false;
  }
  refreshPointsRenderable() {
    const { r, g, b } = this.color_;
    const scaledPoints = this.points_.map((p) => {
      const zDist = Math.abs(p[2] - this.depth_);
      const zScale = zDist / 64 + 1;
      return {
        position: p,
        color: Color.from([r / zScale, g / zScale, b / zScale]),
        size: 20 / zScale,
        markerIndex: this.markerIndex_
      };
    });
    const pointsRenderable = new Points(scaledPoints, Particles.markerAtlas);
    this.objects.length = 0;
    this.addObject(pointsRenderable);
  }
  static get markerAtlas() {
    if (!Particles.markerAtlas_) {
      Particles.markerAtlas_ = Particles.createMarkerAtlas();
    }
    return Particles.markerAtlas_;
  }
  static createMarkerAtlas() {
    const square = (size) => {
      const w = size;
      const h = size;
      const data2 = new Float32Array(w * h);
      data2.fill(1);
      return data2;
    };
    const circle = (size) => {
      const w = size;
      const h = size;
      const data2 = new Float32Array(w * h);
      for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
          if ((i - h / 2) ** 2 + (j - w / 2) ** 2 < (w / 2) ** 2) {
            data2[i * w + j] = 1;
          }
        }
      }
      return data2;
    };
    const triangle = (size) => {
      const w = size;
      const h = size;
      const data2 = new Float32Array(w * h);
      for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
          if (j >= (w - i) / 2 && j <= (w + i) / 2) {
            data2[i * w + j] = 1;
          }
        }
      }
      return data2;
    };
    const SPRITE_SIZE = 256;
    const numMarkers = 3;
    const pixelsPerMarkerSprite = SPRITE_SIZE * SPRITE_SIZE;
    const data = new Float32Array(numMarkers * pixelsPerMarkerSprite);
    const squareData = square(SPRITE_SIZE);
    const circleData = circle(SPRITE_SIZE);
    const triangleData = triangle(SPRITE_SIZE);
    for (let i = 0; i < pixelsPerMarkerSprite; i++) {
      data[i] = circleData[i];
      data[i + pixelsPerMarkerSprite] = squareData[i];
      data[i + 2 * pixelsPerMarkerSprite] = triangleData[i];
    }
    const texture = new Texture2DArray(data, SPRITE_SIZE, SPRITE_SIZE);
    texture.wrapR = "clamp_to_edge";
    texture.wrapS = "clamp_to_edge";
    texture.wrapT = "clamp_to_edge";
    return texture;
  }
}
const ribosomes = new Particles(ribosomeLocations, Color.RED, "circle");
const ferritin = new Particles(ferritinLocations, Color.GREEN, "triangle");
const virusLike = new Particles(
  virusLikeLocations,
  new Color(1, 0, 1),
  "square"
);
ribosomes.setDepth(INITIAL_Z_POSITION);
ferritin.setDepth(INITIAL_Z_POSITION);
virusLike.setDepth(INITIAL_Z_POSITION);
const imageSource = new OmeZarrImageSource(imageUrl);
const loader = await imageSource.open();
const attributes = loader.getAttributes();
const attributesForLastLod = attributes[attributes.length - 1];
const zDimName = "z";
const zAxisIndex = attributesForLastLod.dimensionNames.findIndex(
  (dim) => dim === zDimName
);
const zMin = 0;
const zMax = attributesForLastLod.shape[zAxisIndex];
const zSlider = document.querySelector("#z-slider");
zSlider.min = `${zMin}`;
zSlider.max = `${zMax - 1}`;
zSlider.value = `${INITIAL_Z_POSITION / IMAGE_SCALE_2}`;
const region = [
  { dimension: "z", index: { type: "full" } },
  { dimension: "y", index: { type: "full" } },
  { dimension: "x", index: { type: "full" } }
];
const imageLayer = new ImageSeriesLayer({
  source: imageSource,
  region,
  seriesDimensionName: zDimName,
  channelProps: [{ color: Color.WHITE, contrastLimits: [-1e-5, 1e-5] }]
});
const camera = new OrthographicCamera(0, 1024, 0, 1024, -1e4, 1e4);
const app = new Idetik({
  canvas: document.querySelector("canvas"),
  camera,
  layers: [imageLayer]
}).start();
const onFirstImageLoad = (newState) => {
  if (newState === "ready" && imageLayer.extent !== void 0) {
    camera.setFrame(0, imageLayer.extent.x, 0, imageLayer.extent.y);
    app.cameraControls = new PanZoomControls(camera);
    camera.update();
    app.layerManager.add(ribosomes);
    app.layerManager.add(ferritin);
    app.layerManager.add(virusLike);
    imageLayer.removeStateChangeCallback(onFirstImageLoad);
  }
};
imageLayer.addStateChangeCallback(onFirstImageLoad);
imageLayer.setPosition(INITIAL_Z_POSITION);
let debounce;
zSlider.addEventListener("input", (event) => {
  clearTimeout(debounce);
  const value = event.target.valueAsNumber;
  debounce = setTimeout(async () => {
    await imageLayer.setPosition(value * IMAGE_SCALE_2);
    ribosomes.setDepth(value * IMAGE_SCALE_2);
    ferritin.setDepth(value * IMAGE_SCALE_2);
    virusLike.setDepth(value * IMAGE_SCALE_2);
  }, 20);
});
//# sourceMappingURL=points-BXXfNen2.js.map
