# Getting Started

## Installation

```bash
npm install @idetik/core
```

## Basic Usage

```typescript
import {
  Idetik,
  OrthographicCamera,
  PanZoomControls,
  ChunkedImageLayer,
  OmeZarrImageSource,
  createExplorationPolicy
} from '@idetik/core'

const source = OmeZarrImageSource.fromHttp({
  url: 'https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr/'
})

const camera = new OrthographicCamera(100, 900, 100, 900)
const layer = new ChunkedImageLayer({
  source,
  sliceCoords: { t: 0, c: 0, z: 0 },
  policy: createExplorationPolicy(),
  channelProps: [{ contrastLimits: [0, 150], visible: true }],
})

const idetik = new Idetik({
  canvas: document.querySelector('canvas'),
  viewports: [{
    camera,
    layers: [layer],
    cameraControls: new PanZoomControls(camera),
  }],
})

idetik.start()
```

See the [examples on GitHub](https://github.com/chanzuckerberg/idetik/tree/main/examples) for more complete usage patterns.
