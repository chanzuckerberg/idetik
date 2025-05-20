# @idetik/react

React components for image viewers - wrapping idetik/core functionality

## For Integrators: Using @idetik/react Components

### Installation

```bash
npm install @idetik/react @idetik/core
```

### Basic Usage

Here is an example of using the `OmeZarrImageViewer` component in a Next.js app:
```tsx
"use client";
import { IdetikProvider, OmeZarrImageViewer, ChannelControlsList, Region } from "@idetik/react";

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
      <div className="relative w-full h-full">
        <div className="absolute top-0 left-0 z-10">
          <ChannelControlsList />
        </div>
        <OmeZarrImageViewer
          sourceUrl={zarrUrl}
          region={region}
          seriesDimensionName="Z"
          allSlicesSizeEstimate="250 MB" // Shows on the "Load 3D high-res" button
        />
      </div>
    </IdetikProvider>
  );
}
```

### Advanced usage

To write custom control components, use the `useIdetik()` hook to access and update the global
Idetik state.

#### Tracking Metrics

To track metrics, the `OmeZarrImageViewer` component accepts optional callbacks for the following events:

- `onLayerCreated`
- `onFirstSliceLoaded`
- `onLoadAllSlicesClicked`
- `onAllSlicesLoaded`
- `onLoadAllSlicesAborted`

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