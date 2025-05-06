import {
  Layer,
  LayerManager,
  PanZoomControls,
  PointsGeometry,
  Points,
  WebGLRenderer,
  OrthographicCamera,
  OmeZarrImageSource,
  Region,
  LayerState,
  ImageSeriesLayer,
} from "@";

import { vec3 } from "gl-matrix";

const imageUrl =
  "https://files.cryoetdataportal.cziscience.com/10445/TS_100_3/Reconstructions/VoxelSpacing4.990/Tomograms/100/TS_100_3.zarr";
const ribosomesUrl =
  "https://files.cryoetdataportal.cziscience.com/10445/TS_100_3/Reconstructions/VoxelSpacing4.990/Annotations/104/cytosolic_ribosome-1.0_point.ndjson";
const ferritinUrl =
  "https://files.cryoetdataportal.cziscience.com/10445/TS_100_3/Reconstructions/VoxelSpacing4.990/Annotations/101/ferritin_complex-1.0_point.ndjson";
// image scale for the highest res + points coords
const IMAGE_SCALE_0 = 4.99; // nm/px
// image scale for the lowest res (the image we show)
const IMAGE_SCALE_2 = 19.96; // nm/px
const INITIAL_Z_POSITION = 918.16;

const fetchNDJson = async (url: string) => {
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

const ribosomeLocations = await fetchNDJson(ribosomesUrl);
const ferritinLocations = await fetchNDJson(ferritinUrl);

class Particles extends Layer {
  private points_: vec3[] = [];
  private color_: [number, number, number] = [0, 0, 0];
  private marker_: number = 0;
  private needsUpdate_: boolean = true;
  public position: number = 0;

  constructor(
    points: vec3[],
    color: [number, number, number],
    marker: number,
  ) {
    super();
    this.setState("initialized");
    this.points_ = points;
    this.color_ = color;
    this.marker_ = marker;
    this.update();
    this.setState("ready");
  }

  public setPosition(z: number) {
    this.position = z;
    this.needsUpdate_ = true;
  }

  public update() {
    /**
     * TODO: re-creating the geometry is not efficient,
     * but it's the simplest way to update all the
     * vertex attributes for now.
     **/
    if (!this.needsUpdate_) {
      return;
    }
    const [r, g, b] = this.color_;
    const geometry = new PointsGeometry(
      this.points_.map((p) => {
        const zDist = Math.abs(p[2] - this.position);
        const zScale = zDist / 64.0 + 1.0;
        return {
          position: p,
          color: [r / zScale, g / zScale, b / zScale],
          size: 16.0 / zScale,
          marker: this.marker_,
        };
      })
    );
    const pointsRenderable = new Points(geometry);
    this.objects.length = 0;
    this.addObject(pointsRenderable);
    this.needsUpdate_ = false;
  }
}
const layerManager = new LayerManager();
const ribosomes = new Particles(ribosomeLocations, [1, 0, 0], 0);
const ferritin = new Particles(ferritinLocations, [0, 1, 0], 2);
ribosomes.setPosition(INITIAL_Z_POSITION);
ferritin.setPosition(INITIAL_Z_POSITION);
layerManager.add(ribosomes);
layerManager.add(ferritin);

const renderer = new WebGLRenderer("#canvas");
const camera = new OrthographicCamera(0, 1024, 0, 1024, -10000, 10000);
const controls = new PanZoomControls(camera, [0, 0, 0]);
renderer.setControls(controls);

const imageSource = new OmeZarrImageSource(imageUrl);
const loader = await imageSource.open();
const attributes = await loader.loadAttributes();
const zDimName = "z";
const zAxisIndex = attributes.dimensionNames.findIndex(
  (dim) => dim === zDimName
);
const zMin = 0;
const zMax = attributes.shape[zAxisIndex];
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
  channelProps: [{ color: [1, 1, 1], contrastLimits: [-0.00001, 0.00001] }],
});
const setCameraFrame = (newState: LayerState) => {
  if (newState === "ready" && imageLayer.extent !== undefined) {
    camera.setFrame(0, imageLayer.extent.x, 0, imageLayer.extent.y);
    renderer.setControls(new PanZoomControls(camera, camera.position));
    camera.update();
    // remove the callback to only set the camera frame once
    imageLayer.removeStateChangeCallback(setCameraFrame);
  }
};
imageLayer.addStateChangeCallback(setCameraFrame);
layerManager.add(imageLayer);
imageLayer.setPosition(INITIAL_Z_POSITION);

let debounce: number;
zSlider.addEventListener("input", (event) => {
  clearTimeout(debounce);
  const value = (event.target as HTMLInputElement).valueAsNumber;
  debounce = setTimeout(async () => {
    await imageLayer.setPosition(value * IMAGE_SCALE_2);
    ribosomes.setPosition(value * IMAGE_SCALE_2);
    ferritin.setPosition(value * IMAGE_SCALE_2);
  }, 20);
});

animate();

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}
