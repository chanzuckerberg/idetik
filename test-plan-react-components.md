# Test Plan: Mount/Unmount Behavior for React Components

## Overview

This document outlines the testing strategy for React components in the `packages/react` workspace, specifically focusing on mount/unmount behavior and lifecycle management for `IdetikProvider`, `IdetikContext`, and `IdetikCanvas`.

## Key Component Analysis

### IdetikProvider
- Manages Idetik runtime lifecycle
- Creates/starts runtime on canvas mount
- Stops/cleans runtime on canvas unmount
- Provides context to child components

### IdetikCanvas
- Simple canvas wrapper component
- Integration point that triggers provider's mount/unmount logic
- Handles ref callbacks to provider

## Test Plan Implementation

### 1. Setup Test Infrastructure
- Add Vitest configuration to `packages/react/vite.config.js` (mirror core package setup)
- Install @testing-library/react and @testing-library/jest-dom
- Create test utilities for mocking @idetik/core-prerelease dependencies
- Set up test directory structure: `packages/react/test/`

### 2. IdetikProvider Tests (`test/providers/IdetikProvider.test.tsx`)

**Mount behavior:**
- ✅ Context value is initially `{ runtime: null, onCanvasChange: fn }`
- ✅ Canvas mount creates runtime with camera/controls and starts it
- ✅ Runtime state updates correctly in context

**Unmount behavior:**
- ✅ Canvas unmount stops runtime and sets to null
- ✅ Runtime.stop() is called exactly once
- ✅ Context value updates to `{ runtime: null }`

**Edge cases:**
- ✅ Multiple canvas mount/unmount cycles work correctly
- ✅ Provider unmount cleans up runtime if still active

### 3. IdetikCanvas Tests (`test/components/IdetikCanvas.test.tsx`)

**Mount behavior:**
- ✅ Canvas element renders with correct id and classes
- ✅ onCanvasChange callback called with HTMLCanvasElement on mount
- ✅ Ref properly attached to canvas element

**Unmount behavior:**
- ✅ onCanvasChange callback called with null on unmount
- ✅ Canvas element removed from DOM

**Integration:**
- ✅ Works correctly within IdetikProvider context

### 4. Integration Tests (`test/integration/`)

- ✅ Full provider + canvas integration
- ✅ Complete mount/unmount lifecycle workflows
- ✅ Memory leak detection with multiple cycles

## Critical Areas of Focus

### Memory Management
- Ensure WebGL resources are properly cleaned up
- Verify no lingering event listeners or timers
- Test for memory leaks in repeated mount/unmount cycles

### Race Conditions
- Async initialization vs unmount timing
- Props changes during loading states
- Runtime state changes during component lifecycle

### Error Handling
- Component behavior when runtime is null
- Graceful degradation when core dependencies fail
- Proper error boundaries and cleanup on failures

## Testing Tools and Utilities

### Mock Requirements
- Mock `@idetik/core-prerelease` classes:
  - `Idetik` (runtime)
  - `OrthographicCamera`
  - `PanZoomControls`

### Test Utilities
- Component wrappers with providers
- Mock runtime factory functions
- Async operation helpers
- Memory leak detection utilities

## Success Criteria

- All mount/unmount cycles complete without errors
- No memory leaks detected in repeated cycles
- Proper cleanup of WebGL resources and event listeners
- Graceful handling of edge cases and race conditions
- 100% test coverage for lifecycle-related code paths