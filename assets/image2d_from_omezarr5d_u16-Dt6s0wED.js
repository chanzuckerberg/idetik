import "./modulepreload-polyfill-DaKOjhqt.js";
import { I as Idetik } from "./metadata_loaders-CXLkXwNR.js";
import { O as OmeZarrImageSource, a as OrthographicCamera } from "./image_source-BemCU8_Z.js";
import { P as PanZoomControls } from "./controls-C_nkNJ-y.js";
import { A as AxesLayer } from "./axes_layer-BxgIhTAV.js";
import { I as ImageLayer } from "./image_layer-BUXJ6hGc.js";
import "./projected_line-CtC2xUEg.js";
import "./point_picking-DP3wpFCw.js";
class ScaleBar {
  textDiv_;
  lineDiv_;
  unit_;
  constructor(props) {
    this.textDiv_ = props.textDiv;
    this.lineDiv_ = props.lineDiv;
    this.unit_ = props.unit ?? "";
  }
  update(idetik, _timestamp) {
    const camera2 = idetik.camera;
    if (camera2.type !== "OrthographicCamera") {
      console.error("ScaleBar can only be used with OrthographicCamera");
      return;
    }
    const orthoCamera = camera2;
    const cameraWidthWorld = orthoCamera.transform.scale[0] * orthoCamera.viewportSize[0];
    const unitPerCanvasPixel = cameraWidthWorld / idetik.canvas.clientWidth;
    const lineWidthWorld = this.lineDiv_.clientWidth * unitPerCanvasPixel;
    this.textDiv_.textContent = `${lineWidthWorld.toFixed(2)} ${this.unit_}`;
  }
}
const url = "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";
const left = 150;
const right = 950;
const top = 100;
const bottom = 900;
const source = new OmeZarrImageSource(url);
const region = [
  { dimension: "t", index: { type: "point", value: 400 } },
  { dimension: "c", index: { type: "point", value: 0 } },
  { dimension: "z", index: { type: "point", value: 300 } },
  { dimension: "y", index: { type: "interval", start: top, stop: bottom } },
  { dimension: "x", index: { type: "interval", start: left, stop: right } }
];
const channelProps = [{ contrastLimits: [0, 255] }];
const layer = new ImageLayer({ source, region, channelProps });
const axes = new AxesLayer({ length: 2e3, width: 0.01 });
const camera = new OrthographicCamera(left, right, top, bottom);
const scaleBar = new ScaleBar({
  textDiv: document.querySelector("#scale-bar-text"),
  lineDiv: document.querySelector("#scale-bar-line"),
  unit: "μm"
});
new Idetik({
  canvas: document.querySelector("canvas"),
  camera,
  cameraControls: new PanZoomControls(camera),
  layers: [layer, axes],
  overlays: [scaleBar]
}).start();
//# sourceMappingURL=image2d_from_omezarr5d_u16-Dt6s0wED.js.map
