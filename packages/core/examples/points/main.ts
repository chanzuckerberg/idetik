import {
  Idetik,
  ColorLike,
  Layer,
  PanZoomControls,
  Points,
  OrthographicCamera,
  OmeZarrImageSource,
  Region,
  Texture2DArray,
  LayerState,
  ImageSeriesLayer,
  Color,
} from "@";

import { vec3 } from "gl-matrix";

const baseUrl =
  "https://files.cryoetdataportal.cziscience.com/10445/TS_100_3/Reconstructions/VoxelSpacing4.990";
const imageUrl = `${baseUrl}/Tomograms/100/TS_100_3.zarr`;
const ribosomesUrl = `${baseUrl}/Annotations/104/cytosolic_ribosome-1.0_point.ndjson`;
const ferritinUrl = `${baseUrl}/Annotations/101/ferritin_complex-1.0_point.ndjson`;
const virusLikeUrl = `${baseUrl}/Annotations/106/pp7_vlp-1.0_point.ndjson`;

// image scale for the highest res image --
// point coordinates are stored in the pixel-space of
// the highest res image, and need to be scaled
// by this factor to match our world coordinates
const IMAGE_SCALE_0 = 4.99; // nm/px
// image scale for the lowest res --
// this is the scale of the image we show
// it is used for scaling of the slice/depth
const IMAGE_SCALE_2 = 19.96; // nm/px
const INITIAL_Z_POSITION = 918.16;

const fetchPositionsFromNDJson = async (url: string) => {
  return await fetch(url).then(async (response) => {
    const allPoints = await response.text();
    const points = allPoints
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));
    return points.map((point) => {
      let { x, y, z } = point["location"];
      x = x * IMAGE_SCALE_0;
      y = y * IMAGE_SCALE_0;
      z = z * IMAGE_SCALE_0;
      return [x, y, z] as vec3;
    });
  });
};

const ribosomeLocations = await fetchPositionsFromNDJson(ribosomesUrl);
const ferritinLocations = await fetchPositionsFromNDJson(ferritinUrl);
const virusLikeLocations = await fetchPositionsFromNDJson(virusLikeUrl);

type Marker = "circle" | "square" | "triangle";

class Particles extends Layer {
  public readonly type = "Particles";
  private readonly points_: vec3[] = [];
  private readonly color_: Color;
  private readonly markerIndex_: number = 0;
  private static markerAtlas_: Texture2DArray;
  private needsUpdate_: boolean = true;
  private depth_: number = 0;

  constructor(points: vec3[], color: ColorLike, marker: Marker) {
    super();
    this.setState("initialized");
    this.points_ = points;
    this.color_ = Color.from(color);
    this.markerIndex_ = marker === "circle" ? 0 : marker === "square" ? 1 : 2;
    this.refreshPointsRenderable();
    this.setState("ready");
  }

  public setDepth(z: number) {
    this.depth_ = z;
    this.needsUpdate_ = true;
  }

  public update() {
    if (!this.needsUpdate_) {
      return;
    }
    this.refreshPointsRenderable();
    this.needsUpdate_ = false;
  }

  private refreshPointsRenderable() {
    // TODO: change this to not re-create the renderable object
    // once Geometry supports updating buffers
    const { r, g, b } = this.color_;
    const scaledPoints = this.points_.map((p) => {
      const zDist = Math.abs(p[2] - this.depth_);
      // 64 is just a magic number that looks okay
      const zScale = zDist / 64.0 + 1.0;
      return {
        position: p,
        color: Color.from([r / zScale, g / zScale, b / zScale]),
        size: 20.0 / zScale,
        markerIndex: this.markerIndex_,
      };
    });
    const pointsRenderable = new Points(scaledPoints, Particles.markerAtlas);
    this.objects.length = 0;
    this.addObject(pointsRenderable);
  }

  private static get markerAtlas() {
    if (!Particles.markerAtlas_) {
      Particles.markerAtlas_ = Particles.createMarkerAtlas();
    }
    return Particles.markerAtlas_;
  }

  private static createMarkerAtlas() {
    const square = (size: number) => {
      const w = size;
      const h = size;
      const data = new Float32Array(w * h);
      data.fill(1.0);
      return data;
    };

    const circle = (size: number) => {
      const w = size;
      const h = size;
      const data = new Float32Array(w * h);
      for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
          if ((i - h / 2) ** 2 + (j - w / 2) ** 2 < (w / 2) ** 2) {
            data[i * w + j] = 1.0;
          }
        }
      }
      return data;
    };

    const triangle = (size: number) => {
      const w = size;
      const h = size;
      const data = new Float32Array(w * h);
      for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
          if (j >= (w - i) / 2 && j <= (w + i) / 2) {
            data[i * w + j] = 1.0;
          }
        }
      }
      return data;
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

    // TODO: this uses f32 values, which are not (by defualt) filterable in WebGL2
    // to enable this, we can check/add OES_texture_float_linear.
    // we also don't need the precision of f32 for this so I'd like to use an R8
    // texture instead, but our Texture class does not yet support it.
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
  new Color(1.0, 0.0, 1.0),
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
const zSlider = document.querySelector<HTMLInputElement>("#z-slider")!;
zSlider.min = `${zMin}`;
zSlider.max = `${zMax - 1}`;
zSlider.value = `${INITIAL_Z_POSITION / IMAGE_SCALE_2}`;
const region: Region = [
  { dimension: "z", index: { type: "full" } },
  { dimension: "y", index: { type: "full" } },
  { dimension: "x", index: { type: "full" } },
];
const imageLayer = new ImageSeriesLayer({
  source: imageSource,
  region,
  seriesDimensionName: zDimName,
  channelProps: [{ color: Color.WHITE, contrastLimits: [-0.00001, 0.00001] }],
});

const camera = new OrthographicCamera(0, 1024, 0, 1024, -10000, 10000);
const app = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("canvas")!,
  camera,
  layers: [imageLayer],
}).start();

const onFirstImageLoad = (newState: LayerState) => {
  if (newState === "ready" && imageLayer.extent !== undefined) {
    camera.setFrame(0, imageLayer.extent.x, 0, imageLayer.extent.y);
    app.cameraControls = new PanZoomControls(camera);
    camera.update();

    app.layerManager.add(ribosomes);
    app.layerManager.add(ferritin);
    app.layerManager.add(virusLike);

    // remove the callback to only set the camera frame once
    imageLayer.removeStateChangeCallback(onFirstImageLoad);
  }
};

imageLayer.addStateChangeCallback(onFirstImageLoad);
imageLayer.setPosition(INITIAL_Z_POSITION);

let debounce: ReturnType<typeof setTimeout>;
zSlider.addEventListener("input", (event) => {
  clearTimeout(debounce);
  const value = (event.target as HTMLInputElement).valueAsNumber;
  debounce = setTimeout(async () => {
    await imageLayer.setPosition(value * IMAGE_SCALE_2);
    ribosomes.setDepth(value * IMAGE_SCALE_2);
    ferritin.setDepth(value * IMAGE_SCALE_2);
    virusLike.setDepth(value * IMAGE_SCALE_2);
  }, 20);
});
