# Multi-Layer LOD Blending Plan

## Problem Statement

Support proper blending of multiple `ChunkedImageLayer` instances (multi-channel visualization) with the following requirements:

1. **Within a single layer**: High-resolution chunks must REPLACE (occlude) low-resolution chunks, not blend with them
   - Prevents artificial intensity boost with additive blending (low-res + high-res = 2× intensity)

2. **Across multiple layers**: Layers must blend properly according to their blend modes
   - Different layers (e.g., different fluorescence channels) should blend additively or according to specified blend mode

3. **Must scale to 3D volumes**: Solution must work for both 2D image slicing and 3D volumetric rendering
   - Cannot rely on Z-coordinate tricks that conflict with spatial depth

## Current Architecture Issues

### Current Behavior
- `ChunkStoreView.getChunksToRender()` returns `[...lowResChunks, ...currentLODChunks]`
- All visible chunks render with depth mask disabled (transparent rendering)
- Both low-res AND high-res chunks render and blend together → **double-intensity problem**

### Why Depth Testing Doesn't Work for Multi-Layer
Using Z-position (Z = LOD × offset) with depth testing:
- Works within a single layer (high-res occludes low-res)
- Breaks across layers (Layer1 high-res occludes Layer2 low-res incorrectly)
- Cannot be used for 3D volumes (Z already represents spatial depth)

## Recommended Solution: Indirection Texture Approach

Use an **indirection texture** that tells the shader which LOD chunk to sample from at each spatial location. This technique scales naturally from 2D to 3D.

### Architecture Overview

```
┌──────────────────────────────────────────┐
│ Per-Frame: Update Indirection Texture   │
│  - When chunks load/unload              │
│  - Stores highest-res available LOD     │
└──────────────────────────────────────────┘
            ↓
┌──────────────────────────────────────────┐
│ Indirection Texture (3D)                 │
│  - Low resolution (128³ to 256³)         │
│  - Each voxel stores for all layers:     │
│    • Chunk ID (which chunk covers here)  │
│    • LOD level (resolution)              │
│  - Format: RGBA32UI (4 layers per tex)   │
└──────────────────────────────────────────┘
            ↓
┌──────────────────────────────────────────┐
│ Chunk Texture Arrays                     │
│  - Layer 0: sampler2DArray (all chunks)  │
│  - Layer 1: sampler2DArray (all chunks)  │
│  - Layer N: sampler2DArray (all chunks)  │
│  - Each array layer = one chunk          │
└──────────────────────────────────────────┘
            ↓
┌──────────────────────────────────────────┐
│ Single-Pass Fragment Shader              │
│  1. Sample indirection at world position │
│  2. Get chunk ID + LOD for each layer    │
│  3. Sample from chunk texture arrays     │
│  4. Blend layers (additive/normal/etc)   │
└──────────────────────────────────────────┘
```

## Implementation Details

### 1. Indirection Texture

**Purpose**: Maps world-space positions to chunk IDs and LOD levels.

```javascript
class IndirectionTexture {
  constructor(gl, worldBounds, resolution = 256) {
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this.texture);

    // Format: RGBA32UI (unsigned int)
    // Each component stores one layer's metadata:
    //   High 16 bits: Chunk ID (0 = no chunk)
    //   Low 16 bits: LOD level
    gl.texImage3D(
      gl.TEXTURE_3D,
      0,                           // level
      gl.RGBA32UI,                 // internal format (4 layers)
      resolution, resolution, resolution,
      0,                           // border
      gl.RGBA_INTEGER,             // format
      gl.UNSIGNED_INT,             // type
      null                         // data (filled dynamically)
    );

    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

    this.resolution = resolution;
    this.worldBounds = worldBounds;
  }

  // Called when chunks load/unload
  update(layers) {
    const res = this.resolution;
    const data = new Uint32Array(res * res * res * 4);

    // For each voxel in indirection texture
    for (let z = 0; z < res; z++) {
      for (let y = 0; y < res; y++) {
        for (let x = 0; x < res; x++) {
          // Convert voxel coordinates to world space
          const worldPos = this.voxelToWorld([x, y, z]);

          // For each layer, find highest-resolution chunk at this position
          for (let layerIdx = 0; layerIdx < Math.min(layers.length, 4); layerIdx++) {
            const layer = layers[layerIdx];
            const chunk = layer.findHighestResChunkAt(worldPos);

            if (chunk) {
              // Pack chunk ID (high 16 bits) and LOD (low 16 bits)
              const packed = (chunk.globalID << 16) | chunk.lod;
              const idx = (z * res * res + y * res + x) * 4 + layerIdx;
              data[idx] = packed;
            }
          }
        }
      }
    }

    gl.texSubImage3D(
      gl.TEXTURE_3D, 0, 0, 0, 0,
      res, res, res,
      gl.RGBA_INTEGER, gl.UNSIGNED_INT, data
    );
  }

  voxelToWorld([x, y, z]) {
    const res = this.resolution;
    const bounds = this.worldBounds;
    return [
      bounds.min[0] + (x / res) * (bounds.max[0] - bounds.min[0]),
      bounds.min[1] + (y / res) * (bounds.max[1] - bounds.min[1]),
      bounds.min[2] + (z / res) * (bounds.max[2] - bounds.min[2]),
    ];
  }
}
```

**Key Points:**
- Resolution: 128³ (34 MB) or 256³ (268 MB) for 4 layers
- Updated only when chunks load/unload (not every frame)
- Stores ONE chunk ID per layer per location (no double-intensity)
- Uses NEAREST filtering (no interpolation of integer IDs)

### 2. Chunk Texture Arrays

**Purpose**: Store actual image data for all loaded chunks.

```javascript
class ChunkTextureArray {
  constructor(gl, chunkSize = 512, maxChunks = 256) {
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);

    // Create texture array: each layer is one chunk
    gl.texImage3D(
      gl.TEXTURE_2D_ARRAY,
      0,
      gl.R16F,                    // Single-channel 16-bit float
      chunkSize, chunkSize,       // Width, height of each chunk
      maxChunks,                  // Number of array layers (max chunks)
      0,
      gl.RED,
      gl.HALF_FLOAT,
      null
    );

    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.chunkSize = chunkSize;
    this.maxChunks = maxChunks;
    this.chunkMap = new Map();  // globalChunkID -> array layer index
    this.nextLayer = 0;
  }

  // Upload chunk data to texture array
  uploadChunk(globalChunkID, data, width, height) {
    if (this.nextLayer >= this.maxChunks) {
      // Need eviction policy (LRU, etc.)
      throw new Error('Chunk texture array full');
    }

    const layerIndex = this.nextLayer++;
    this.chunkMap.set(globalChunkID, layerIndex);

    gl.texSubImage3D(
      gl.TEXTURE_2D_ARRAY,
      0,
      0, 0, layerIndex,           // x, y, z offset
      width, height, 1,           // width, height, depth
      gl.RED,
      gl.HALF_FLOAT,
      data
    );

    return layerIndex;
  }

  removeChunk(globalChunkID) {
    const layerIndex = this.chunkMap.get(globalChunkID);
    if (layerIndex !== undefined) {
      this.chunkMap.delete(globalChunkID);
      // Layer can be reused (add to free list)
    }
  }
}
```

**Key Points:**
- One texture array per layer (channel)
- Each array layer stores one chunk's data
- Global chunk ID maps to array layer index
- Need chunk eviction policy when array fills

### 3. Fragment Shader (2D Slicing)

```glsl
#version 300 es
precision highp float;
precision highp usampler3D;
precision highp sampler2DArray;

// Indirection texture
uniform usampler3D u_indirectionTexture;

// Chunk texture arrays (one per layer/channel)
uniform sampler2DArray u_layer0Chunks;
uniform sampler2DArray u_layer1Chunks;
uniform sampler2DArray u_layer2Chunks;

// Channel visualization properties
uniform vec3 u_layer0Color;      // e.g., [0, 1, 1] for cyan
uniform vec3 u_layer1Color;      // e.g., [1, 0, 1] for magenta
uniform vec3 u_layer2Color;      // e.g., [1, 1, 0] for yellow
uniform vec2 u_layer0ContrastLimits;
uniform vec2 u_layer1ContrastLimits;
uniform vec2 u_layer2ContrastLimits;

// World space bounds
uniform vec3 u_worldMin;
uniform vec3 u_worldMax;
uniform float u_sliceZ;          // Z position for 2D slice

in vec2 v_screenCoord;           // Screen coordinates [0, 1]
out vec4 fragColor;

// Unpack chunk ID and LOD from 32-bit uint
void unpackChunkInfo(uint packed, out uint chunkID, out uint lod) {
  chunkID = packed >> 16u;
  lod = packed & 0xFFFFu;
}

// Convert world position to chunk-local UV coordinates
vec2 worldToChunkUV(vec3 worldPos, uint chunkID, uint lod) {
  // This depends on your chunk layout
  // Simplified: assume chunks are aligned on power-of-2 grid

  float lodScale = exp2(float(lod));  // LOD 0 = 1x, LOD 1 = 2x, etc.
  vec2 scaledPos = worldPos.xy * lodScale;

  // Get fractional part for UV within chunk
  vec2 uv = fract(scaledPos);

  return uv;
}

// Sample a layer's chunk texture array
vec4 sampleLayer(sampler2DArray chunkArray, vec3 worldPos, uint chunkID, uint lod,
                 vec3 color, vec2 contrastLimits) {
  if (chunkID == 0u) {
    return vec4(0.0);  // No chunk loaded for this layer at this position
  }

  // Convert chunk ID to texture array layer index
  float arrayLayer = float(chunkID - 1u);  // ID 0 = no chunk, ID 1+ = array layers

  // Get UV coordinates within chunk
  vec2 uv = worldToChunkUV(worldPos, chunkID, lod);

  // Sample chunk texture array
  float intensity = texture(chunkArray, vec3(uv, arrayLayer)).r;

  // Apply contrast limits
  float normalized = (intensity - contrastLimits.x) / (contrastLimits.y - contrastLimits.x);
  normalized = clamp(normalized, 0.0, 1.0);

  // Apply channel color
  return vec4(color * normalized, normalized);
}

void main() {
  // Convert screen coordinates to world space
  vec3 worldPos;
  worldPos.xy = mix(u_worldMin.xy, u_worldMax.xy, v_screenCoord);
  worldPos.z = u_sliceZ;

  // Normalize world position to [0, 1] for indirection texture lookup
  vec3 indirectionCoord = (worldPos - u_worldMin) / (u_worldMax - u_worldMin);

  // Sample indirection texture to get chunk metadata for all layers
  uvec4 packedInfo = texture(u_indirectionTexture, indirectionCoord);

  // Unpack chunk information for each layer
  uint chunk0ID, chunk1ID, chunk2ID;
  uint lod0, lod1, lod2;
  unpackChunkInfo(packedInfo.r, chunk0ID, lod0);
  unpackChunkInfo(packedInfo.g, chunk1ID, lod1);
  unpackChunkInfo(packedInfo.b, chunk2ID, lod2);

  // Sample each layer
  // Each layer samples from exactly ONE chunk (highest-res available)
  // No double-intensity within a layer!
  vec4 layer0 = sampleLayer(u_layer0Chunks, worldPos, chunk0ID, lod0,
                           u_layer0Color, u_layer0ContrastLimits);
  vec4 layer1 = sampleLayer(u_layer1Chunks, worldPos, chunk1ID, lod1,
                           u_layer1Color, u_layer1ContrastLimits);
  vec4 layer2 = sampleLayer(u_layer2Chunks, worldPos, chunk2ID, lod2,
                           u_layer2Color, u_layer2ContrastLimits);

  // Blend layers (additive blending example)
  fragColor = layer0 + layer1 + layer2;

  // Or use alpha blending:
  // fragColor = layer0;
  // fragColor.rgb += layer1.rgb * layer1.a * (1.0 - fragColor.a);
  // fragColor.a += layer1.a * (1.0 - fragColor.a);
  // fragColor.rgb += layer2.rgb * layer2.a * (1.0 - fragColor.a);
  // fragColor.a += layer2.a * (1.0 - fragColor.a);
}
```

### 4. Fragment Shader (3D Volume Ray Marching)

```glsl
#version 300 es
precision highp float;
precision highp usampler3D;
precision highp sampler2DArray;

// Same uniforms as 2D version...

uniform vec3 u_cameraPosition;
uniform mat4 u_invViewProjMatrix;

out vec4 fragColor;

// Same helper functions (unpackChunkInfo, worldToChunkUV, sampleLayer)...

void main() {
  // Compute ray direction from camera through this pixel
  vec4 nearPoint = u_invViewProjMatrix * vec4(v_screenCoord * 2.0 - 1.0, -1.0, 1.0);
  vec4 farPoint = u_invViewProjMatrix * vec4(v_screenCoord * 2.0 - 1.0, 1.0, 1.0);
  nearPoint /= nearPoint.w;
  farPoint /= farPoint.w;

  vec3 rayOrigin = nearPoint.xyz;
  vec3 rayDir = normalize(farPoint.xyz - nearPoint.xyz);

  // Find intersection with volume bounding box
  vec3 tMin = (u_worldMin - rayOrigin) / rayDir;
  vec3 tMax = (u_worldMax - rayOrigin) / rayDir;
  vec3 t1 = min(tMin, tMax);
  vec3 t2 = max(tMin, tMax);
  float tNear = max(max(t1.x, t1.y), t1.z);
  float tFar = min(min(t2.x, t2.y), t2.z);

  if (tNear > tFar || tFar < 0.0) {
    discard;  // Ray misses volume
  }

  // Ray marching
  vec4 accumColor = vec4(0.0);
  float t = max(tNear, 0.0);
  const float stepSize = 0.01;  // Adjust based on volume resolution
  const int maxSteps = 500;

  for (int step = 0; step < maxSteps && t < tFar; step++) {
    vec3 samplePos = rayOrigin + rayDir * t;

    // Normalize to [0,1] for indirection lookup
    vec3 indirectionCoord = (samplePos - u_worldMin) / (u_worldMax - u_worldMin);

    // Sample indirection texture
    uvec4 packedInfo = texture(u_indirectionTexture, indirectionCoord);

    // Unpack and sample each layer
    uint chunk0ID, chunk1ID, chunk2ID, lod0, lod1, lod2;
    unpackChunkInfo(packedInfo.r, chunk0ID, lod0);
    unpackChunkInfo(packedInfo.g, chunk1ID, lod1);
    unpackChunkInfo(packedInfo.b, chunk2ID, lod2);

    vec4 layer0 = sampleLayer(u_layer0Chunks, samplePos, chunk0ID, lod0,
                             u_layer0Color, u_layer0ContrastLimits);
    vec4 layer1 = sampleLayer(u_layer1Chunks, samplePos, chunk1ID, lod1,
                             u_layer1Color, u_layer1ContrastLimits);
    vec4 layer2 = sampleLayer(u_layer2Chunks, samplePos, chunk2ID, lod2,
                             u_layer2Color, u_layer2ContrastLimits);

    // Blend layers at this sample point
    vec4 sampleColor = layer0 + layer1 + layer2;

    // Front-to-back compositing
    float alpha = sampleColor.a * stepSize;
    accumColor.rgb += sampleColor.rgb * alpha * (1.0 - accumColor.a);
    accumColor.a += alpha * (1.0 - accumColor.a);

    // Early ray termination
    if (accumColor.a > 0.95) break;

    t += stepSize;
  }

  fragColor = accumColor;
}
```

## Integration with Existing Architecture

### Changes to ChunkedImageLayer

```typescript
class ChunkedImageLayer extends Layer {
  private globalChunkTextureArray_: ChunkTextureArray;

  // Map chunk to global ID for indirection texture
  getGlobalChunkID(chunk: Chunk): number {
    return this.globalChunkTextureArray_.getChunkID(chunk);
  }

  // Register chunk when loaded
  onChunkLoaded(chunk: Chunk) {
    const globalID = this.globalChunkTextureArray_.uploadChunk(
      chunk.id,
      chunk.data,
      chunk.shape.x,
      chunk.shape.y
    );

    // Notify indirection texture that it needs update
    this.context.indirectionTexture.markDirty();
  }

  // Find highest-resolution chunk at world position
  findHighestResChunkAt(worldPos: vec3): Chunk | null {
    // Query ChunkStoreView for all chunks at this position
    const chunks = this.chunkStoreView_.getChunksAt(worldPos);

    // Return chunk with lowest LOD number (highest resolution)
    return chunks.reduce((best, chunk) => {
      if (chunk.state !== 'loaded') return best;
      if (!best || chunk.lod < best.lod) return chunk;
      return best;
    }, null);
  }
}
```

### Changes to WebGLRenderer

```typescript
class WebGLRenderer extends Renderer {
  private indirectionTexture_: IndirectionTexture;

  render(viewport: Viewport) {
    // ... existing opaque rendering ...

    const { opaque, transparent } = viewport.layerManager.partitionLayers();

    // Identify ChunkedImageLayers
    const chunkedLayers = transparent.filter(l => l.type === 'ChunkedImageLayer');
    const otherTransparent = transparent.filter(l => l.type !== 'ChunkedImageLayer');

    if (chunkedLayers.length > 0) {
      // Update indirection texture if needed
      if (this.indirectionTexture_.isDirty()) {
        this.indirectionTexture_.update(chunkedLayers);
      }

      // Render all chunked layers in single draw call
      this.renderChunkedLayers(chunkedLayers, viewport.camera);
    }

    // Render other transparent layers normally
    for (const layer of otherTransparent) {
      this.renderLayer(layer, viewport.camera, frustum);
    }
  }

  private renderChunkedLayers(layers: ChunkedImageLayer[], camera: Camera) {
    // Bind indirection texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, this.indirectionTexture_.texture);

    // Bind chunk texture arrays
    layers.forEach((layer, idx) => {
      gl.activeTexture(gl.TEXTURE1 + idx);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, layer.chunkTextureArray.texture);
    });

    // Set uniforms
    const program = this.programs_.use('multi_layer_chunked');
    program.setUniform('u_indirectionTexture', 0);
    program.setUniform('u_layer0Chunks', 1);
    program.setUniform('u_layer1Chunks', 2);
    // ... etc for all layers

    // Set channel properties
    layers.forEach((layer, idx) => {
      const props = layer.channelProps[0];
      program.setUniform(`u_layer${idx}Color`, props.color);
      program.setUniform(`u_layer${idx}ContrastLimits`, props.contrastLimits);
    });

    // Render fullscreen quad
    this.renderFullscreenQuad();
  }
}
```

## Performance Characteristics

### Memory Usage

**Indirection Texture:**
- 128³ × 16 bytes (4 layers) = **34 MB**
- 256³ × 16 bytes (4 layers) = **268 MB**
- Recommendation: Start with 128³, increase if LOD transitions are visible

**Chunk Texture Arrays:**
- Per layer: max_chunks × chunk_size² × bytes_per_pixel
- Example: 256 chunks × 512² × 2 bytes (R16F) = **128 MB per layer**
- For 3 layers: **384 MB total**

**Total: ~400-650 MB** depending on configuration

### Render Performance

**Single-Pass Rendering:**
- 1 draw call for all ChunkedImageLayers
- Indirection lookup: ~1 texture fetch (cached in GPU L1)
- Per-layer sampling: ~1 texture fetch per layer
- Total: ~4 texture fetches per pixel for 3 layers

**Expected Frame Time:**
- 1920×1080, 3 layers: **~2-3ms** on modern GPU (RTX 3060 or better)
- 3840×2160, 3 layers: **~8-10ms**

**Compared to Alternatives:**
- Per-layer FBO approach: ~3-5ms (multiple render passes)
- Indirection approach: ~2-3ms (single pass)
- **~30% faster** due to single draw call

### Update Frequency

**Indirection texture update** (when chunks load/unload):
- Compute cost: O(resolution³ × num_layers)
- 128³ × 4 layers: ~8M operations
- Can be done on CPU in **~10-20ms**
- Or use compute shader (if available): **~1-2ms**
- Typically only needed when zooming/panning to new regions

## Optimization Opportunities

### 1. Sparse Indirection (For Very Large Worlds)

Use hierarchical sparse structure:

```javascript
// Coarse grid: 32³ × 4 bytes = 128 KB
// Fine grids: allocated on-demand, 8³ each = 2 KB per fine grid
// For 1000 occupied coarse cells: 128 KB + 2 MB = ~2 MB total

class SparseIndirection {
  coarseTexture: Texture3D;      // 32³, stores fine grid indices
  fineTextureArray: Texture3D;   // 8³ × N, stores actual chunk IDs
}
```

**Memory savings:** 268 MB → 2-10 MB for sparse data

### 2. Incremental Indirection Updates

Only update modified regions:

```javascript
update(layers, dirtyRegions) {
  for (const region of dirtyRegions) {
    // Update only [xMin, yMin, zMin] → [xMax, yMax, zMax]
    const subData = computeSubregion(region);
    gl.texSubImage3D(..., region.min, region.size, subData);
  }
}
```

### 3. Chunk Eviction Policy

Implement LRU for chunk texture array:

```javascript
class LRUChunkArray extends ChunkTextureArray {
  private accessOrder: Map<number, number>;  // chunkID → last access frame

  uploadChunk(chunkID, data) {
    if (this.isFull()) {
      const evictID = this.findLRU();
      this.removeChunk(evictID);
    }
    super.uploadChunk(chunkID, data);
    this.accessOrder.set(chunkID, currentFrame);
  }
}
```

### 4. Mipmapping for Indirection Texture

Generate mipmaps for indirection to avoid aliasing:

```javascript
gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
gl.generateMipmap(gl.TEXTURE_3D);
```

This smooths LOD transitions when indirection resolution is coarse.

## Benefits Summary

✅ **No double-intensity**: Each layer samples from exactly one chunk per location

✅ **Proper blending**: Layers blend correctly according to blend modes

✅ **Scales to 3D**: Same architecture works for 2D slicing and 3D volumes

✅ **Single-pass rendering**: All layers rendered in one draw call (efficient)

✅ **WebGL2 features**: Leverages texture arrays and 3D textures

✅ **Dynamic LOD**: Automatically adapts as chunks load/unload

✅ **Extensible**: Easy to add more layers or change blend modes

## Future Enhancements

1. **Compute shader updates** (WebGPU): Move indirection updates to GPU
2. **Sparse octree indirection**: Further reduce memory for very large/sparse volumes
3. **Temporal coherence**: Cache indirection updates across frames
4. **Adaptive resolution**: Vary indirection resolution based on zoom level
5. **Multi-scale blending**: Smooth LOD transitions with trilinear filtering between LODs

## References

- Virtual Texturing: Mittring, M. "Advanced Virtual Texture Topics" (2008)
- Sparse Voxel Octrees: Laine, S. & Karras, T. "Efficient Sparse Voxel Octrees" (2010)
- Volume Rendering: Engel et al. "Real-Time Volume Graphics" (2006)

---

**Author**: Generated during architectural planning discussion
**Date**: 2025-12-01
**Status**: Design phase - ready for prototyping
