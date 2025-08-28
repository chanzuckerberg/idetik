# @idetik/react-prerelease

🚨 **This package is under active development.** Use at your own risk in production environments.

React components for interactive visualization of large datasets, built on the Idetik runtime.

## For Integrators: Using @idetik/react Components

### Installation

```bash
npm install @idetik/react @idetik/core
```

### Basic Usage: OmeZarrImageViewer (Reference Viewer)

The simplest way to get started is with the `OmeZarrImageViewer` reference viewer:

```tsx
"use client";
import { IdetikProvider, OmeZarrImageViewer } from "@idetik/react";
import { Region } from "@idetik/core";

// Define the region to view
const region: Region = [
  { dimension: "T", index: { type: "point", value: 0 } },
  { dimension: "C", index: { type: "full" } },
  { dimension: "Z", index: { type: "full" } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } },
];

export function ImageViewer({ zarrUrl }: { zarrUrl: string }) {
  return (
    <IdetikProvider>
      <OmeZarrImageViewer
        sourceUrl={zarrUrl}
        region={region}
        seriesDimensionName="Z"
        loadAllButtonText="Load 3D high-res (250MB)"
      />
    </IdetikProvider>
  );
}
```

The `OmeZarrImageViewer` is a complete reference viewer that includes its own canvas, built-in channel controls, slice navigation, and loading indicators.
It provides 2D visualization of image data stored in OME-Zarr format, with support for multi-dimensional datasets and a single "series" dimension (e.g., Z-slices, time frames).

#### Tracking Metrics

To track metrics, the `OmeZarrImageViewer` component accepts optional callbacks for the following events:

- `onLayerCreated`
- `onFirstSliceLoaded`
- `onLoadAllSlicesClicked`
- `onAllSlicesLoaded`
- `onLoadAllSlicesAborted`

### Advanced Usage: Building Custom Viewers

A **Viewer** is any component that contains an `IdetikCanvas` and manages its own visualization layers. You can build custom viewers for different data types or interaction patterns:

```tsx
import { IdetikProvider, IdetikCanvas, useIdetik } from "@idetik/react";
import { ImageSeriesLayer, OmeZarrImageSource } from "@idetik/core";
import { useState, useEffect, useSyncExternalStore } from "react";

function CustomViewer({ sourceUrl }: { sourceUrl: string }) {
  const [layer, setLayer] = useState<ImageSeriesLayer | null>(null);
  const { isReady, runtime } = useIdetik();

  const activeLayers = useSyncExternalStore(
    (callback) => {
      if (!isReady) return () => {};
      return contextValue.runtime.layerManager.addLayersChangeCallback(callback);
    },
    () => {
      if (!isReady) return [];
      return contextValue.runtime.layerManager.layers;
    }
  );

  useEffect(() => {
    if (!isReady) return;

    const source = new OmeZarrImageSource(sourceUrl);
    const newLayer = new ImageSeriesLayer({
      source,
      region: yourRegion,
      seriesDimensionName: "Z"
    });
    runtime.layerManager.add(newLayer);
    setLayer(newLayer);

    return () => {
      if (layer && runtime.layerManager.layers.includes(layer)) {
        runtime.layerManager.remove(layer);
      }
    };
  }, [contextValue, sourceUrl]);

  return (
    <div className="w-full h-full relative">
      <IdetikCanvas />
      <div className="absolute top-4 left-4 text-white">
        Active layers: {activeLayers.length}
      </div>
    </div>
  );
}

export function App() {
  return (
    <IdetikProvider>
      <CustomViewer sourceUrl="https://example.com/data.zarr" />
    </IdetikProvider>
  );
}
```

### Core Concepts

**IdetikProvider**: Wraps your application and manages the Idetik runtime instance. Must be placed at the root of any component tree that uses Idetik components.

**IdetikCanvas**: Renders the WebGL canvas. Must be placed somewhere inside the IdetikProvider. Only one canvas per provider is supported.

**Viewers**: Components that contain an `IdetikCanvas` and manage their own layers. Examples include `OmeZarrImageViewer` (reference implementation) or custom viewers for specific use cases.

**useIdetik Hook**: Provides access to the runtime state:
- When `isReady: false`: Provides `initializeWithCanvas(canvas)` function
- When `isReady: true`: Provides `runtime` (Idetik instance)

**Layer Management**: Use `runtime.layerManager` directly:
- `runtime.layerManager.add(layer)` - Add a layer
- `runtime.layerManager.remove(layer)` - Remove a layer
- `runtime.layerManager.layers` - Get current layers array
- `runtime.layerManager.addLayersChangeCallback(callback)` - Subscribe to layer changes

**Reactive Updates**: Use `useSyncExternalStore` to subscribe to runtime state changes. Prefer this
over duplicating state in your components, where possible. If you need access to library state that
doesn't provide a compatible interface, consider adding it.
```tsx
const layers = useSyncExternalStore(
  runtime.layerManager.addLayersChangeCallback,
  () => runtime.layerManager.layers
);
```

## For Internal Developers

### Getting Started

```bash
# Install dependencies from root directory
npm install

# Build dependencies (core package) from the root directory
npm run build

# Start development server
npm run dev
```

The development server will automatically load sample data from a publicly hosted Zarr file at:
`https://public.czbiohub.org/organelle_box/datasets/A549/organelle_box_crop_v1.zarr`

No need to host any data locally to start development.

### Development with Core Package

If you make changes to the `@idetik/core` package, you'll need to:
1. Rebuild the core package: `npm run build --workspace=@idetik/core`
2. Rebuild this package: `npm run build --workspace=@idetik/react`

This ensures your React components use the latest version of the core package.

### Component Development Guidelines

Pure TypeScript code (has no react dependencies) should go in the `lib/` directory.

#### File Structure
Each component should have its own directory with the following structure:
```
ComponentName/
├── index.tsx         # Public API exports
├── ComponentName.tsx # Main implementation
├── utils.ts         # Component-specific utilities (if needed)
└── components/      # Sub-components (if needed)
```

#### Best Practices

1. **Exports**
   - Use named exports instead of default exports
   - Export components through index.tsx files
   - This keeps our API clean and makes it easier to refactor without introducing breaking changes.
   - Also helps with tree-shaking because bundlers can statically analyze named exports and safely exclude unused code from the final bundle. Default exports, by contrast, are opaque and prevent the bundler from confidently removing unused parts.
   ```typescript
   // Avoid
   export default function MyComponent() {}

   // Prefer
   export function MyComponent() {}
   // In index.tsx:
   export { MyComponent } from './MyComponent';
   ```

2. **Component Definitions**
   - Use arrow functions for component definitions
   - Include explicit type annotations
   ```typescript
   // Avoid
   export function MyComponent(props: Props) {}

   // Prefer
   export const MyComponent = ({ prop1, prop2 }: MyComponentProps) => {
        return <div>...</div>;
    };
   ```

3. **Props**
   - Define prop interfaces with explicit types
   - Use descriptive prop names
   ```typescript
   interface MyComponentProps {
     sourceUrl: string;
     onUpdate: (data: UpdateData) => void;
     isLoading?: boolean;
   }
   ```

5. **Styling**
   - Use Tailwind CSS with classnames utility
   - Group related classes with cns
   ```typescript
   import cns from 'classnames';

   const className = cns(
     'flex',
     'flex-col',
     'gap-4',
     isActive && 'bg-blue-500'
   );
   ```

### Available Scripts

- `npm run dev` - Start the Vite development server
- `npm run compile` - Run TypeScript compilation
- `npm run build` - Full production build (Vite build + TypeScript compilation + Rollup bundle)
- `npm run format` - Format all TypeScript/TSX/HTML/JSON files using Prettier
- `npm run format-check` - Check if files are properly formatted
- `npm run lint` - Run ESLint on all files
