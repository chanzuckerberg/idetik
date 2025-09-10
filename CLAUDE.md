# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a TypeScript monorepo for a layer-based visualization library for interactive display of large datasets. It uses npm workspaces with two main packages:

- `@idetik/core-prerelease` - Core visualization library (packages/core/)
- `@idetik/react-prerelease` - React component wrapper (packages/react/)

The core package contains:
- `core/` - Core rendering and layer management
- `layers/` - Different visualization layer types 
- `renderers/` - WebGL rendering implementations
- `data/` - Data loading and processing utilities
- `utilities/` - Helper functions and utilities

The react package provides React components and hooks that wrap the core library functionality.

## Development Commands

### From repository root:
- `npm install` - Install all dependencies
- `npm run examples` - Start development server on http://localhost:5173
- `npm run build` - Build core package only
- `npm run build:all` - Build all packages
- `npm run format:all` - Format code in all packages

### From core workspace (packages/core/):
- `npm run dev` - Start development server
- `npm test` - Run tests with watch mode
- `npm run test -- --run` - Run tests once
- `npm run test-with-coverage` - Generate coverage report
- `npm run compile` - TypeScript compilation
- `npm run build` - Full build (vite + tsc + rollup)
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### From react workspace (packages/react/):
- `npm run dev` - Start development server
- `npm run compile` - TypeScript compilation  
- `npm run build` - Full build (vite + tsc + rollup)
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Code Style

The project uses ESLint with TypeScript rules and Prettier for formatting. Key conventions:
- Private class properties must end with underscore (`_`)
- Unused variables/parameters should be prefixed with underscore
- React hooks rules are enforced
- No duplicate imports allowed

## Testing

Tests use Vitest and run in browser environment. Coverage reports are generated with Istanbul.