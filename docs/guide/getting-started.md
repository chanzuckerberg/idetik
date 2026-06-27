# Getting Started

## Installation

```bash
npm install @idetik/core
```

## Basic Usage

Render a volume from a remote OME-Zarr source:

```typescript
import {
  Idetik,
  PerspectiveCamera,
  OrbitControls,
  VolumeLayer,
  OmeZarrImageSource,
  createExplorationPolicy,
} from '@idetik/core'

const source = await OmeZarrImageSource.fromHttp({
  url: 'https://public.czbiohub.org/royerlab/zebrahub/imaging/multi-view/ZMNS001.ome.zarr/',
})

const camera = new PerspectiveCamera()

const layer = new VolumeLayer({
  source,
  sliceCoords: { t: 0, z: undefined, c: undefined }, // show all channels
  // The volume layer renders a single LOD, so pin one in the policy.
  policy: createExplorationPolicy({ lod: { min: 2, max: 2 } }),
  channelProps: [
    { visible: true, color: '#00ffff', contrastLimits: [300, 1500] }, // h2afva
    { visible: true, color: '#ff00ff', contrastLimits: [75, 500] }, // mezzo
  ],
})

// Frame the camera using the source's physical dimensions: aim at the
// volume center and back off to ~120% of its largest extent.
const dims = source.getDimensions()
const span = (d: typeof dims.x) => d.lods[0].size * d.lods[0].scale
const center = (d: typeof dims.x) => d.lods[0].translation + span(d) / 2
const target: [number, number, number] = [center(dims.x), center(dims.y), center(dims.z!)]
const radius = 1.2 * Math.max(span(dims.x), span(dims.y), span(dims.z!))

const idetik = new Idetik({
  canvas: document.querySelector<HTMLCanvasElement>('canvas')!,
  viewports: [{
    camera,
    layers: [layer],
    cameraControls: new OrbitControls(camera, { radius, target }),
  }],
})

idetik.start()
```

See the [examples on GitHub](https://github.com/chanzuckerberg/idetik/tree/main/examples) for more complete usage patterns.
