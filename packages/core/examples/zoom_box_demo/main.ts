import {
  Idetik,
  ImageLayer,
  ChunkedImageLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
} from "@";
import { PanZoomControls } from "@/objects/cameras/controls";
import { Color } from "@/core/color";
import { Viewport } from "@/core/viewport";
import { LayerManager } from "@/core/layer_manager";
import { ZoomBoxLayer } from "./zoom_box_layer";

// Use the same sample data as the basic image example
const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/";

// Define the region bounds in data coordinates
const zoomLeft = 150;
const zoomRight = 950;
const zoomTop = 100;
const zoomBottom = 900;

// Create separate sources to avoid conflicts between layers
const mainSource = new OmeZarrImageSource(url);
const minimapSource = new OmeZarrImageSource(url);

// Slice coordinates for both viewports (same 3D slice)
const sliceCoords = {
  t: 400,
  c: 0,
  z: 300,
};

// Full image region for minimap using explicit intervals with proper scale
// For this dataset: scale appears to be 1.0 for x,y based on other examples
const scale = 1.0;
const imageSize = 2048;
const worldSize = imageSize * scale; // 2048 * 1.0 = 2048

const fullRegion: Region = [
  { dimension: "t", index: { type: "point", value: 400 } },
  { dimension: "c", index: { type: "point", value: 0 } },
  { dimension: "z", index: { type: "point", value: 300 } },
  { dimension: "y", index: { type: "interval", start: 0, stop: worldSize } },
  { dimension: "x", index: { type: "interval", start: 0, stop: worldSize } },
];

const channelProps = [{ contrastLimits: [0, 255] as [number, number] }];

// Create layers with separate sources to avoid conflicts
const fullImageLayer = new ImageLayer({
  source: minimapSource,
  region: fullRegion, // ImageLayer with full region for minimap
  channelProps, // Use same channel props as zoom image
});

const zoomImageLayer = new ChunkedImageLayer({
  source: mainSource,
  sliceCoords, // ChunkedImageLayer for main viewport with LOD support
  channelProps,
});
zoomImageLayer.debugMode = true;

// Create cameras - bounds will be updated once ChunkedImageLayer loads
const mainCamera = new OrthographicCamera(
  zoomLeft,
  zoomRight,
  zoomTop,
  zoomBottom
);
const minimapCamera = new OrthographicCamera(0, 1000, 0, 1000); // Temporary, will be updated

// Create zoom box layer that shows main camera's view on the minimap
const zoomBoxLayer = new ZoomBoxLayer({
  targetCamera: mainCamera,
  color: Color.GREEN,
  width: 0.015,
});

// Create main Idetik instance
const idetik = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>("#main-canvas")!,
  viewports: [
    {
      camera: mainCamera,
      cameraControls: new PanZoomControls(mainCamera),
      layers: [zoomImageLayer],
    },
  ],
});

// UNSAFE: Manually add a second viewport to the internal viewports array
// This is a hack since there's no official API for multiple viewports yet
const minimapCanvas =
  document.querySelector<HTMLCanvasElement>("#minimap-canvas")!;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const minimapLayerManager = new LayerManager((idetik as any).context_);

// Add layers to minimap layer manager
minimapLayerManager.add(fullImageLayer);
minimapLayerManager.add(zoomBoxLayer);

// Update minimap camera bounds once the ImageLayer loads
fullImageLayer.addStateChangeCallback((newState) => {
  if (newState === "ready" && fullImageLayer.extent !== undefined) {
    minimapCamera.setFrame(
      0,
      fullImageLayer.extent.x,
      0,
      fullImageLayer.extent.y
    );
  }
});

const minimapViewport = new Viewport(
  {
    id: "minimap",
    element: minimapCanvas,
    camera: minimapCamera,
    layers: [], // layers are managed through layerManager
  },
  minimapLayerManager
);

// UNSAFE: Access private viewports_ array and add our minimap viewport
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(idetik as any).viewports_.push(minimapViewport);

// Start the combined Idetik instance (will render both viewports)
idetik.start();
