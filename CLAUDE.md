# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Package (@idetik/core-prerelease)
- `npm run examples` - Start development server for core examples (port 5173)
- `npm run dev --workspace=@idetik/core-prerelease` - Alternative way to start core dev server
- `npm run compile --workspace=@idetik/core-prerelease` - TypeScript compilation
- `npm run build --workspace=@idetik/core-prerelease` - Build core package
- `npm run test --workspace=@idetik/core-prerelease` - Run tests with watch mode
- `npm run test-with-coverage --workspace=@idetik/core-prerelease` - Run tests with coverage report
- `npm run test -- --run --workspace=@idetik/core-prerelease` - Run tests once and exit
- `npm run lint --workspace=@idetik/core-prerelease` - Run ESLint
- `npm run format --workspace=@idetik/core-prerelease` - Format code with Prettier
- `npm run format-check --workspace=@idetik/core-prerelease` - Check formatting

### React Package (@idetik/react-prerelease)
- `npm run components` - Start React components development server
- `npm run dev --workspace=@idetik/react-prerelease` - Alternative way to start React dev server
- `npm run build --workspace=@idetik/react-prerelease` - Build React package
- `npm run lint --workspace=@idetik/react-prerelease` - Run ESLint
- `npm run format --workspace=@idetik/react-prerelease` - Format code with Prettier
- `npm run format-check --workspace=@idetik/react-prerelease` - Check formatting

### Repository-wide Commands
- `npm run build:all` - Build all packages
- `npm run format:all` - Format all packages

## Architecture Overview

This is a monorepo with two main packages providing a layer-based visualization library for large datasets:

### Core Package (`packages/core`)
The core visualization engine built on WebGL:

**Main Components:**
- `Idetik` class - Main runtime that manages canvas, rendering, and viewport system
- `WebGLRenderer` - WebGL rendering engine with shader program management
- `LayerManager` - Manages visualization layers and their lifecycle
- `ChunkManager` - Handles chunked data loading and management for large datasets
- `Viewport` - Multi-viewport support system (in transition from single viewport)

**Key Subsystems:**
- **Layers** (`src/layers/`) - Various layer types: `ChunkedImageLayer`, `ImageLayer`, `LabelImageLayer`, `TracksLayer`, `ProjectedLineLayer`, `AxesLayer`, `ImageSeriesLayer`
- **Cameras** (`src/objects/cameras/`) - `OrthographicCamera`, `PerspectiveCamera` with `PanZoomControls`
- **Data Sources** (`src/data/`) - OME-Zarr data loading and processing
- **Math Utils** (`src/math/`) - `Box2`, `Box3` geometry utilities
- **WebGL Infrastructure** (`src/renderers/`) - Shaders, buffers, textures, WebGL state management

### React Package (`packages/react`)
React components and hooks wrapping the core visualization:

**Components:**
- `IdetikProvider` - Context provider for Idetik instances
- `OmeZarrImageViewer` - Complete viewer for OME-Zarr image data
- `ChannelControlsList` - UI controls for image channels (color picker, contrast, visibility)
- `ScaleBar` - Scale bar overlay component
- `IdetikCanvas` - Base canvas component

**Architecture Notes:**
- Core package uses class-based WebGL architecture with extensive TypeScript typing
- React package provides declarative component interface over imperative core
- Multi-viewport support is partially implemented (single viewport currently used)
- Heavy use of WebGL shaders for performance with large datasets
- OME-Zarr format support for scientific imaging data

## Code Conventions

- **TypeScript**: Strict typing throughout, private class properties suffixed with `_`
- **ESLint Rules**: 
  - No duplicate imports
  - Unused vars must be prefixed with `_`
  - Private class properties must be suffixed with `_`
  - React hooks and refresh rules applied
- **Prettier**: 2-space tabs, no trailing commas except ES5, no tabs
- **Testing**: Vitest with Playwright browser testing in headless Chromium
- **Build**: Vite + Rollup for bundling, supports both UMD and ESM exports

## Data Handling
- Primary focus on OME-Zarr scientific imaging format
- Chunked data loading for handling large datasets
- WebGL texture management for efficient GPU rendering
- Support for multi-channel image data with individual channel controls