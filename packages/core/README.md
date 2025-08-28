# @idetik/core

🚨 **This package is under active development.** Use at your own risk in production environments.

A layer-based visualization abstraction for interactive rendering of large datasets, with particular focus on scientific imaging and bioinformatics data formats.

## Key Components

### Core Architecture
- `Idetik`: Main runtime
- `LayerManager`: Manages layer composition and rendering order
- `WebGLRenderer`: GPU-accelerated rendering engine
- `Layer`: Base class for all visualization layers

### Layer Types
- `ImageLayer`: Static image rendering
- `ChunkedImageLayer`: Streaming large image data
- `ImageSeriesLayer`: Time-series and multi-dimensional images
- `LabelImageLayer`: Segmentation masks and labels
- `TracksLayer`: Object tracking visualization
- `ProjectedLineLayer`: Line and curve rendering
- `AxesLayer`: Coordinate system visualization

## Examples

The `/examples` directory contains comprehensive demonstrations:

- **Basic image visualization**: 2D image rendering from OME-Zarr
- **Multi-dimensional data**: 5D datasets (x, y, z, channel, time)
- **High Content Screening**: Plate/well data visualization  
- **Label overlays**: Segmentation masks with value picking
- **Image series**: Time-lapse and z-stack navigation
- **Streaming data**: Chunk-based loading for large datasets
- **Layer composition**: Blending multiple visualization layers
- **Interactive features**: Point selection and data sampling

## Development

### Building
```bash
npm run build  # Compile TypeScript and bundle
```

### Testing
```bash
npm test              # Run tests with watch mode
npm run test-with-coverage  # Generate coverage report
```

### Development Server
```bash
npm run dev           # Start development server with examples
```
