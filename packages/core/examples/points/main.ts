import {
  AxesLayer,
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

const zLocation = 918.16;
const IMAGE_SCALE = 4.99;  // nm/px
const IMAGE_SCALE_0 = 19.96; // nm/px

const imageUrl = "https://files.cryoetdataportal.cziscience.com/10445/TS_100_3/Reconstructions/VoxelSpacing4.990/Tomograms/100/TS_100_3.zarr";
const ribosomesUrl = "https://files.cryoetdataportal.cziscience.com/10445/TS_100_3/Reconstructions/VoxelSpacing4.990/Annotations/104/cytosolic_ribosome-1.0_point.ndjson";
const ferritinUrl = "https://files.cryoetdataportal.cziscience.com/10445/TS_100_3/Reconstructions/VoxelSpacing4.990/Annotations/101/ferritin_complex-1.0_point.ndjson";

const fetchNDJson = async (url: string) => {
  return await fetch(url).then(async (response) => {
    const allPoints = await response.text();
    const points = allPoints
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));
    return points.map((point) => {
      let { x, y, z } = point["location"];
      x = x * IMAGE_SCALE;
      y = y * IMAGE_SCALE;
      z = z * IMAGE_SCALE;
      return [x, y, z] as [number, number, number];
    });
  });
};

const ribosomeLocations = await fetchNDJson(ribosomesUrl);
const ferritinLocations = await fetchNDJson(ferritinUrl);

class PointsLayer extends Layer {
  private points_: [number, number, number][] = [];
  private color_: [number, number, number] = [0, 0, 0];
  private needsUpdate_: boolean = true;
  public zLocation: number = 0;

  constructor(points: [number, number, number][], color: [number, number, number]) {
    super();
    this.setState("initialized");
    this.points_ = points;
    this.color_ = color;
    this.update();
    this.setState("ready");
  }

  public setZLocation(z: number) {
    this.zLocation = z;
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
    const geometry = new PointsGeometry(this.points_.map((p) => {
      const zDist = Math.abs(p[2] - this.zLocation);
      const zScale = zDist / 64.0 + 1.0;
      return {
        position: p,
        color: [
          r / zScale,
          g / zScale,
          b / zScale,
        ],
        size: 16.0 / zScale,
        marker: 0,
      };
    }));
    const pointsRenderable = new Points(geometry);
    this.objects.length = 0;
    this.addObject(pointsRenderable);
    this.needsUpdate_ = false;
  }
}
const layerManager = new LayerManager();
layerManager.add(new AxesLayer(
  { length: 0.25, width: 0.01 }
));
const ribosomes = new PointsLayer(ribosomeLocations, [1, 0, 0]);
const ferritin = new PointsLayer(ferritinLocations, [0, 1, 0]);
ribosomes.setZLocation(zLocation);
ferritin.setZLocation(zLocation);
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
zSlider.value = `${zLocation / IMAGE_SCALE_0}`;
const region: Region = [
  { dimension: "z", index: { type: "full" } },
  { dimension: "y", index: { type: "full" } },
  { dimension: "x", index: { type: "full" } },
];
const imageLayer = new ImageSeriesLayer({
  source: imageSource,
  region,
  seriesDimensionName: zDimName,
  channelProps: [
    { color: [1, 1, 1], contrastLimits: [-0.00001, 0.00001] },
  ],
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
imageLayer.setPosition(zLocation);

let debounce: number;
zSlider.addEventListener("input", (event) => {
  clearTimeout(debounce);
  const value = (event.target as HTMLInputElement).valueAsNumber;
  debounce = setTimeout(async () => {
    imageLayer.setIndex(value);
    ribosomes.setZLocation(value * IMAGE_SCALE_0);
    ferritin.setZLocation(value * IMAGE_SCALE_0);
  }, 20);
});


animate();

function animate() {
  renderer.render(layerManager, camera);
  requestAnimationFrame(animate);
}
