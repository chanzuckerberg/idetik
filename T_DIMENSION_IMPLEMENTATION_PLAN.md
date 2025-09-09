# T Dimension Implementation Plan: 4D Spatiotemporal Support

## Overview

This plan implements time/t dimension support in the chunk_manager and chunked_image_layer modules, treating time as a first-class dimension alongside space (following the principle of spacetime unity). The t dimension will be implemented exactly like the z dimension, supporting 4D spatiotemporal chunking where each chunk represents a region in space-time.

**Key Principle**: Time dimension has the largest stride in the binary data layout and should be sliced first, followed by spatial dimensions.

## Implementation Status

- [ ] **Phase 1: Data Structure Updates** (`chunk.ts`)
  - [ ] Add t dimension to Chunk type shape property
  - [ ] Add t dimension to Chunk type chunkIndex property  
  - [ ] Add t dimension to Chunk type scale property
  - [ ] Add t dimension to Chunk type offset property

- [ ] **Phase 2: Chunk Manager Updates** (`chunk_manager.ts`)
  - [ ] Add 4D chunk generation loop (x, y, z, t)
  - [ ] Implement getTBounds() method
  - [ ] Implement tBoundsChanged() method  
  - [ ] Add lastTBounds_ tracking field
  - [ ] Update updateChunkVisibility() for 4D bounds
  - [ ] Implement isChunkWithinTimeBounds() method
  - [ ] Update update() method to include t bounds checking

- [ ] **Phase 3: Chunked Image Layer Updates** (`chunked_image_layer.ts`)
  - [ ] Add tPrevPointWorld_ tracking field
  - [ ] Implement resliceIfTChanged() method
  - [ ] Implement sliceTime() method (mirrors slicePlane)
  - [ ] Update resliceIfTChanged() to call sliceTime
  - [ ] Update getDataForImage() to handle temporal slicing first
  - [ ] Update update() method to call resliceIfTChanged()

## Detailed Implementation

### 1. Data Structure Updates (`chunk.ts`)

**Location**: Lines 27-57, Chunk type definition

**Changes**:
```typescript
export type Chunk = {
  // ... existing properties ...
  shape: {
    x: number;
    y: number;
    z: number;
    c: number;
    t: number;  // ✅ Add this
  };
  chunkIndex: {
    x: number;
    y: number;
    z: number;
    t: number;  // ✅ Add this
  };
  scale: {
    x: number;
    y: number;
    z: number;
    t: number;  // ✅ Add this
  };
  offset: {
    x: number;
    y: number;
    z: number;
    t: number;  // ✅ Add this
  };
};
```

### 2. Chunk Manager Updates (`chunk_manager.ts`)

#### A. Add T Dimension Tracking Fields

**Location**: After line 32 (after `private lastZBounds_?: [number, number];`)

**Changes**:
```typescript
private lastTBounds_?: [number, number];  // ✅ Add this
```

#### B. Update Constructor for 4D Chunk Generation

**Location**: Lines 44-98, chunk generation loops

**Changes**: Add t dimension loop and properties:
```typescript
// Around line 48, after zLod declaration
const tLod = this.dimensions_.t?.lods[lod];  // ✅ Add this

// Around line 53, after chunkDepth
const chunkTime = tLod?.chunkSize ?? 1;     // ✅ Add this

// Around line 57, after chunksZ
const chunksT = Math.ceil((tLod?.size ?? 1) / chunkTime);  // ✅ Add this

// Update the nested loops - add t loop after z loop around line 64
for (let t = 0; t < chunksT; ++t) {    // ✅ Add this loop
  const tOffset = tLod !== undefined
    ? tLod.translation + t * chunkTime * tLod.scale
    : 0;
  
  this.chunks_.push({
    // ... existing properties ...
    shape: {
      x: chunkWidth,
      y: chunkHeight,
      z: chunkDepth,
      c: channels,
      t: chunkTime,  // ✅ Add this
    },
    chunkIndex: { x, y, z, t },  // ✅ Update this
    scale: {
      x: xLod.scale,
      y: yLod.scale,
      z: zLod?.scale ?? 1,
      t: tLod?.scale ?? 1,  // ✅ Add this
    },
    offset: {
      x: xOffset,
      y: yOffset,
      z: zOffset,
      t: tOffset,  // ✅ Add this
    },
  });
}  // ✅ Close new t loop
```

#### C. Add T Bounds Methods

**Location**: After `getZBounds()` method (around line 298)

**Changes**:
```typescript
private getTBounds(): [number, number] {  // ✅ Add this method
  const tDim = this.dimensions_.t;
  if (tDim === undefined || this.sliceCoords_.t === undefined) return [0, 1];

  const tLod = tDim.lods[this.currentLOD_];
  const tShape = tLod.size;
  const tScale = tLod.scale;
  const tTran = tLod.translation;
  const tPoint = Math.floor((this.sliceCoords_.t - tTran) / tScale);
  const chunkTime = tLod.chunkSize;

  const tChunk = Math.max(0, Math.min(
    Math.floor(tPoint / chunkTime),
    Math.ceil(tShape / chunkTime) - 1
  ));

  return [
    tTran + tChunk * chunkTime * tScale,
    tTran + (tChunk + 1) * chunkTime * tScale,
  ];
}

private tBoundsChanged(newBounds: [number, number]): boolean {  // ✅ Add this method
  const prev = this.lastTBounds_;
  const changed = !prev || !vec2.equals(prev, newBounds);
  if (changed) {
    this.lastTBounds_ = newBounds;
  }
  return changed;
}
```

#### D. Update update() Method

**Location**: Lines 124-134

**Changes**:
```typescript
public update(lodFactor: number, viewBounds2D: Box2) {
  this.setLOD(lodFactor);
  const zBounds = this.getZBounds();
  const tBounds = this.getTBounds();  // ✅ Add this

  if (
    this.viewBounds2DChanged(viewBounds2D) ||
    this.zBoundsChanged(zBounds) ||
    this.tBoundsChanged(tBounds)  // ✅ Add this
  ) {
    this.updateChunkVisibility(viewBounds2D);
  }
}
```

#### E. Update updateChunkVisibility() Method

**Location**: Lines 172-227

**Changes**:
```typescript
private updateChunkVisibility(viewBounds2D: Box2): void {
  if (this.chunks_.length === 0) {
    Logger.warn("ChunkManagerSource", "updateChunkVisibility called with no chunks initialized");
    return;
  }

  const [zMin, zMax] = this.getZBounds();
  const [tMin, tMax] = this.getTBounds();  // ✅ Add this
  const viewBounds3D = new Box3(
    vec3.fromValues(viewBounds2D.min[0], viewBounds2D.min[1], zMin),
    vec3.fromValues(viewBounds2D.max[0], viewBounds2D.max[1], zMax)
  );
  const timeBounds: [number, number] = [tMin, tMax];  // ✅ Add this

  const paddedBounds = this.getPaddedBounds(viewBounds3D);
  for (const chunk of this.chunks_) {
    const spatiallyVisible = this.isChunkWithinBounds(chunk, viewBounds3D);
    const temporallyVisible = this.isChunkWithinTimeBounds(chunk, timeBounds);  // ✅ Add this
    const isVisible = spatiallyVisible && temporallyVisible;  // ✅ Update this
    const eligibleForPrefetch = !isVisible && this.isChunkWithinBounds(chunk, paddedBounds) && temporallyVisible;  // ✅ Update this

    // ... rest of existing logic using isVisible
  }
}

private isChunkWithinTimeBounds(chunk: Chunk, timeBounds: [number, number]): boolean {  // ✅ Add this method
  const chunkTimeMin = chunk.offset.t;
  const chunkTimeMax = chunk.offset.t + chunk.shape.t * chunk.scale.t;
  const [tMin, tMax] = timeBounds;
  
  return chunkTimeMax > tMin && chunkTimeMin < tMax;
}
```

### 3. Chunked Image Layer Updates (`chunked_image_layer.ts`)

#### A. Add T Dimension Tracking Field

**Location**: After line 38 (after `private zPrevPointWorld_?: number;`)

**Changes**:
```typescript
private tPrevPointWorld_?: number;  // ✅ Add this
```

#### B. Update update() Method

**Location**: Lines 71-74

**Changes**:
```typescript
public update() {
  this.updateChunks();
  this.resliceIfZChanged();
  this.resliceIfTChanged();  // ✅ Add this
}
```

#### C. Add resliceIfTChanged() Method

**Location**: After `resliceIfZChanged()` method (around line 115)

**Changes**:
```typescript
private resliceIfTChanged() {  // ✅ Add this method
  const tPointWorld = this.sliceCoords_.t;
  if (tPointWorld === undefined || this.tPrevPointWorld_ === tPointWorld) {
    return;
  }

  for (const [chunk, image] of this.visibleChunks_) {
    if (chunk.state !== "loaded" || !chunk.data) continue;
    const data = this.sliceTime(chunk, tPointWorld);
    if (data) {
      const texture = image.textures[0] as Texture2DArray;
      texture.updateWithChunk(chunk, data);
    }
  }

  this.tPrevPointWorld_ = tPointWorld;
}
```

#### D. Add sliceTime() Method

**Location**: After `slicePlane()` method (around line 145)

**Changes**:
```typescript
private sliceTime(chunk: Chunk, tValue: number) {  // ✅ Add this method
  if (!chunk.data) return;
  
  const tLocal = (tValue - chunk.offset.t) / chunk.scale.t;
  const tIdx = Math.round(tLocal);
  const tClamped = clamp(tIdx, 0, chunk.shape.t - 1);

  if (!almostEqual(tLocal, tClamped, 1 + 1e-6)) {
    Logger.error("ChunkedImageLayer", "sliceTime tValue outside extent");
  }

  // Time has largest stride - slice entire spatial volumes
  const spatialSliceSize = chunk.shape.x * chunk.shape.y * chunk.shape.z;
  const offset = spatialSliceSize * tClamped;
  return chunk.data.slice(offset, offset + spatialSliceSize);
}
```

#### E. Update getDataForImage() Method

**Location**: Lines 176-186

**Changes**:
```typescript
private getDataForImage(chunk: Chunk) {  // ✅ Update this method
  let data = chunk.data;
  
  // Apply temporal slicing first (largest stride)
  if (this.sliceCoords_?.t !== undefined) {
    data = this.sliceTime(chunk, this.sliceCoords_.t);
  }
  
  // Then apply spatial z slicing if we have data and z coordinate
  if (this.sliceCoords_?.z !== undefined && data) {
    const zLocal = (this.sliceCoords_.z - chunk.offset.z) / chunk.scale.z;
    const zIdx = Math.round(zLocal);
    const zClamped = clamp(zIdx, 0, chunk.shape.z - 1);
    
    if (!almostEqual(zLocal, zClamped, 1 + 1e-6)) {
      Logger.error("ChunkedImageLayer", "slicePlane zValue outside extent");
    }
    
    const sliceSize = chunk.shape.x * chunk.shape.y;
    const offset = sliceSize * zClamped;
    data = data.slice(offset, offset + sliceSize);
  }

  if (!data) {
    Logger.warn("ChunkedImageLayer", "No data for image after slicing");
    return;
  }
  return data;
}
```

## Testing Strategy

1. **Unit Tests**: Test each new method independently
2. **Integration Tests**: Test 4D chunk generation and bounds checking  
3. **Data Flow Tests**: Verify temporal slicing with sample OME-Zarr data
4. **Performance Tests**: Ensure 4D chunking doesn't degrade performance

## Implementation Order

1. Start with data structure updates (Phase 1) - minimal risk
2. Implement chunk manager changes (Phase 2) - core functionality  
3. Add image layer temporal slicing (Phase 3) - user-facing features
4. Test integration with existing OME-Zarr loader
5. Performance optimization if needed

## Notes

- T dimension already supported in OME-Zarr loader (`ome_zarr/image_loader.ts`)
- SliceCoordinates already includes `t?: number`
- SourceDimensionMap already includes `t?: SourceDimension`
- This implementation maintains backward compatibility - t dimension is optional