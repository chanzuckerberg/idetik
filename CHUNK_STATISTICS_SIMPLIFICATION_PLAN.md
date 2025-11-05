# Chunk Statistics Simplification Plan

## Goals
1. Add per-LOD state counts (loaded, loading, queued, unloaded) for better visibility in the overlay
2. Simplify the API - remove unnecessary interfaces and complexity
3. Provide direct access to stats for a specific time point and LOD

## Current Issues
- **Confusing hierarchy**: `TimeIndexStats` with nested `LODStats` is overly complex
- **Too many interfaces**: `LODStats`, `TimeIndexStats`, plus implementation classes
- **Cloning overhead**: `getStatsForTime()` clones the entire stats tree, which is unnecessary
- **No per-LOD state counts**: Can't show loaded/loading/queued per LOD in the overlay
- **Indirect API**: Have to do `getStatsForTime(t).perLOD.get(lod)` to get LOD stats

## Proposed Solution: Single ChunkStats Class

### Key Insight
Statistics should be tracked at the **(time, LOD)** level. That's the fundamental unit.
- Each chunk belongs to exactly one time index and one LOD
- We want to query stats for a specific time and LOD combination

### New Structure

**One simple class:**
```typescript
class ChunkStats {
  totalChunks = 0;
  unloadedChunks = 0;
  queuedChunks = 0;
  loadingChunks = 0;
  loadedChunks = 0;
  visibleChunks = 0;
  prefetchedChunks = 0;
}
```

**Storage structure:**
```typescript
// Array of LODs, each containing an array of time points
// stats_[lod][time] = ChunkStats
// LOD-first because different LODs can have different numbers of time points
private stats_: ChunkStats[][] = [];
```

**Simple API:**
```typescript
// Get stats for a specific time and LOD - that's all we need!
getStats(timeIndex: number, lod: number): ChunkStats
```

## Observer Callbacks

### trackChunk()
Initialize stats when a chunk is created:
```typescript
trackChunk(chunk: Chunk): void {
  chunk.addObserver(this);

  const stats = this.getOrCreateStats(chunk.chunkIndex.t, chunk.lod);
  stats.totalChunks++;
  this.incrementStateCount(stats, chunk.state);

  if (chunk.visible) stats.visibleChunks++;
  if (chunk.prefetch) stats.prefetchedChunks++;
}
```

### onStateChange()
Update state counts:
```typescript
onStateChange(chunk: Chunk, oldState: ChunkState, newState: ChunkState): void {
  const stats = this.getOrCreateStats(chunk.chunkIndex.t, chunk.lod);

  this.decrementStateCount(stats, oldState);
  this.incrementStateCount(stats, newState);
}
```

### onVisibilityChange()
Update visibility count:
```typescript
onVisibilityChange(chunk: Chunk, visible: boolean): void {
  const stats = this.getOrCreateStats(chunk.chunkIndex.t, chunk.lod);
  stats.visibleChunks += visible ? 1 : -1;
}
```

### onPrefetchChange()
Update prefetch count:
```typescript
onPrefetchChange(chunk: Chunk, prefetch: boolean): void {
  const stats = this.getOrCreateStats(chunk.chunkIndex.t, chunk.lod);
  stats.prefetchedChunks += prefetch ? 1 : -1;
}
```

### onLODChange()
Move all counts from old LOD to new LOD:
```typescript
onLODChange(chunk: Chunk, oldLOD: number, newLOD: number): void {
  const oldStats = this.getOrCreateStats(chunk.chunkIndex.t, oldLOD);
  const newStats = this.getOrCreateStats(chunk.chunkIndex.t, newLOD);

  // Move from old to new
  oldStats.totalChunks--;
  newStats.totalChunks++;

  this.decrementStateCount(oldStats, chunk.state);
  this.incrementStateCount(newStats, chunk.state);

  if (chunk.visible) {
    oldStats.visibleChunks--;
    newStats.visibleChunks++;
  }
  if (chunk.prefetch) {
    oldStats.prefetchedChunks--;
    newStats.prefetchedChunks++;
  }
}
```

## Updated ChunkInfoOverlay

Much cleaner usage:
```typescript
const stats = chunkManagerSource.statistics;
const lodCount = chunkManagerSource.lodCount;

for (let lod = 0; lod < lodCount; lod++) {
  const lodStats = stats.getStats(currentTimeIndex, lod);

  const prefix = lod === currentLOD ? `LOD ${lod} (current)` : `LOD ${lod}`;
  lines.push(
    `${prefix}: Loaded ${lodStats.loadedChunks}/${lodStats.totalChunks} | ` +
    `Visible ${lodStats.visibleChunks} | Prefetched ${lodStats.prefetchedChunks}`
  );
}

// Summary across all LODs (if needed)
let totalLoaded = 0;
let totalChunks = 0;
for (let lod = 0; lod < lodCount; lod++) {
  const lodStats = stats.getStats(currentTimeIndex, lod);
  totalLoaded += lodStats.loadedChunks;
  totalChunks += lodStats.totalChunks;
}
```

## Benefits
1. **Much simpler**: One class instead of 4 (2 interfaces + 2 implementations)
2. **Clearer conceptually**: Stats are at the (time, LOD) level - that's what chunks are
3. **Better visibility**: Per-LOD state counts for the overlay
4. **Better performance**: Arrays instead of Maps, no cloning overhead
5. **Cleaner API**: `getStats(time, lod)` - simple and direct

## Implementation Steps
1. Create new `ChunkStats` class with all 7 fields
2. Replace storage with `ChunkStats[][]` (LOD-first: `stats_[lod][time]`)
3. Remove `LODStats`, `LODStatsImpl`, `TimeIndexStats`, `TimeIndexStatsImpl`
4. Implement `getStats(time, lod)` to return `ChunkStats` (creates lazily if needed)
5. Remove `getStatsForTime()` - no longer needed
6. Update `trackChunk()` to initialize stats at (time, lod) level
7. Update `onStateChange()` to update stats at (time, lod) level
8. Update `onVisibilityChange()` to update stats at (time, lod) level
9. Update `onPrefetchChange()` to update stats at (time, lod) level
10. Update `onLODChange()` to move all counts between LODs
11. Update `disposeTimeIndex()` to handle array-based storage
12. Update all tests to use new API
13. Update ChunkInfoOverlay to use `getStats(time, lod)`
