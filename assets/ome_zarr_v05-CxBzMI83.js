import "./modulepreload-polyfill-DaKOjhqt.js";
import { I as Idetik } from "./metadata_loaders-CXLkXwNR.js";
import { O as OmeZarrImageSource, a as OrthographicCamera } from "./image_source-BemCU8_Z.js";
import { P as PanZoomControls } from "./controls-C_nkNJ-y.js";
import { A as AxesLayer } from "./axes_layer-BxgIhTAV.js";
import { C as ChunkedImageLayer } from "./chunked_image_layer-DuyACZAI.js";
import "./projected_line-CtC2xUEg.js";
import "./point_picking-DP3wpFCw.js";
const url = "https://ome-zarr-scivis.s3.us-east-1.amazonaws.com/v0.5/96x2/marmoset_neurons.ome.zarr";
const source = new OmeZarrImageSource(url);
const loader = await source.open();
const attributes = loader.getAttributes();
const attributesAtLod0 = attributes[0];
const dimensionInfo = (dimensionName) => {
  const index = attributesAtLod0.dimensionNames.findIndex(
    (d) => d === dimensionName
  );
  return {
    size: attributesAtLod0.shape[index],
    scale: attributesAtLod0.scale[index],
    offset: attributesAtLod0.translation[index]
  };
};
const zInfo = dimensionInfo("z");
const zMidPoint = zInfo.offset + 0.5 * zInfo.size * zInfo.scale;
const yInfo = dimensionInfo("y");
const xInfo = dimensionInfo("x");
const sliceCoords = { z: zMidPoint };
const channelProps = { contrastLimits: [0, 200] };
const pickInfoDiv = document.querySelector("#pick-info");
const onPickValue = (info) => {
  const { world, value } = info;
  pickInfoDiv.innerHTML = `
    <strong>Pick Result:</strong><br/>
    World: (${world[0].toFixed(1)}, ${world[1].toFixed(1)}, ${world[2].toFixed(1)})<br/>
    Pixel Value: ${value}<br/>
  `;
};
const layer = new ChunkedImageLayer({
  source,
  sliceCoords,
  channelProps,
  onPickValue
});
const axes = new AxesLayer({
  length: 0.75 * xInfo.scale * xInfo.size,
  width: 0.01
});
const camera = new OrthographicCamera(
  xInfo.offset,
  xInfo.offset + xInfo.scale * xInfo.size,
  yInfo.offset,
  yInfo.offset + yInfo.scale * yInfo.size
);
const cameraControls = new PanZoomControls(camera);
new Idetik({
  canvas: document.querySelector("canvas"),
  camera,
  cameraControls,
  layers: [layer, axes]
}).start();
//# sourceMappingURL=ome_zarr_v05-CxBzMI83.js.map
