# @idetik/react

React components for image viewers - wrapping idetik/core functionality

## Getting Started

```bash
# Install dependencies from root directory
npm install

# Build dependencies (core package)
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

## Component Development Guidelines

### File Structure
Each component should have its own directory with the following structure:
```
ComponentName/
├── index.tsx         # Public API exports
├── ComponentName.tsx # Main implementation
├── utils.ts         # Component-specific utilities (if needed)
└── components/      # Sub-components (if needed)
```

### Best Practices

1. **Exports**
   - Use named exports instead of default exports
   - Export components through index.tsx files
   ```typescript
   // Bad
   export default function MyComponent() {}

   // Good
   export function MyComponent() {}
   // In index.tsx:
   export { MyComponent } from './MyComponent';
   ```

2. **Component Definitions**
   - Use arrow functions for component definitions
   - Include explicit type annotations
   ```typescript
   // Bad
   export function MyComponent(props: Props) {}

   // Good
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

4. **State Management**
   - Use hooks for state management
   - Keep state as local as possible
   ```typescript
   const [data, setData] = useState<Data | null>(null);
   const [isLoading, setIsLoading] = useState(false);
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

## Available Scripts

- `npm run dev` - Start the Vite development server
- `npm run compile` - Run TypeScript compilation
- `npm run build` - Full production build (Vite build + TypeScript compilation + Rollup bundle)
- `npm run format` - Format all TypeScript/TSX/HTML/JSON files using Prettier
- `npm run format-check` - Check if files are properly formatted
- `npm run lint` - Run ESLint on all files