# Chunk Statistics Redesign Plan

## Current Design Issues

1. **Manual tracking scattered everywhere**: We have to manually call `statistics_.recordStateTransition()` at every place where chunk properties change
2. **Complex aggregate statistics**: Maintaining aggregate stats across all time indices adds unnecessary complexity
3. **Tight coupling**: ChunkQueue needs a callback, ChunkManagerSource needs to track changes manually
4. **Error-prone**: Easy to forget to call statistics recording methods

## Proposed Simplifications

### 1. Remove Aggregate Statistics
- **Remove**: `AggregateStats` interface
- **Remove**: `ChunkStatistics.getAggregateStats()`
- **Remove**: `ChunkManager.getAggregateStatistics()`
- **Keep**: Per-time-index statistics (`TimeIndexStats`)
- **Keep**: Per-LOD statistics (`LODStats`)

**Rationale**: ChunkInfoOverlay only cares about the current time point. We don't need to aggregate across all time indices. If we need aggregate stats later, they can be computed on-demand.

### 2. Convert Chunk from Type to Class

Transform `Chunk` from a plain object type to a class with observable properties.

**Key observable properties:**
- `state`: "unloaded" | "queued" | "loading" | "loaded"
- `visible`: boolean
- `prefetch`: boolean
- `lod`: number

**Non-observable properties** (no statistics impact):
- `data`: ChunkData
- `priority`: number | null
- `orderKey`: number | null
- `shape`, `rowAlignmentBytes`, `chunkIndex`, `scale`, `offset`: metadata

### 3. Observer Pattern for Chunks

```typescript
interface ChunkObserver {
  onStateChange?(chunk: Chunk, oldState: ChunkState, newState: ChunkState): void;
  onVisibilityChange?(chunk: Chunk, visible: boolean): void;
  onPrefetchChange?(chunk: Chunk, prefetch: boolean): void;
  onLODChange?(chunk: Chunk, oldLOD: number, newLOD: number): void;
}

class Chunk {
  private observers_: Set<ChunkObserver> = new Set();

  addObserver(observer: ChunkObserver): void;
  removeObserver(observer: ChunkObserver): void;

  // Setters that notify observers
  set state(newState: ChunkState) { ... }
  set visible(newVisible: boolean) { ... }
  set prefetch(newPrefetch: boolean) { ... }
  set lod(newLOD: number) { ... }
}
```

### 4. ChunkStatistics as Observer

```typescript
class ChunkStatistics implements ChunkObserver {
  // Simplified: only per-time stats
  private perTimeStats_: Map<number, TimeIndexStats>;

  // ChunkManagerSource passes chunks to statistics during creation
  trackChunk(chunk: Chunk): void {
    chunk.addObserver(this);
    // Initialize counts
  }

  untrackChunk(chunk: Chunk): void {
    chunk.removeObserver(this);
    // Decrement counts
  }

  // Observer callbacks - automatically invoked by Chunk
  onStateChange(chunk: Chunk, oldState: ChunkState, newState: ChunkState): void {
    // Update statistics
  }

  onVisibilityChange(chunk: Chunk, visible: boolean): void {
    // Update statistics
  }

  // ... other observer methods
}
```

## Detailed Implementation Plan

### Phase 1: Convert Chunk Type to Class

**File**: `packages/core/src/data/chunk.ts`

1. Keep existing interfaces for metadata types (`ChunkShape`, `ChunkIndex`, etc.)
2. Create `ChunkObserver` interface
3. Convert `Chunk` from type to class:
   ```typescript
   export class Chunk {
     // Observable properties (private with getters/setters)
     private state_: ChunkState = "unloaded";
     private visible_: boolean = false;
     private prefetch_: boolean = false;
     private lod_: number;

     // Non-observable properties (public)
     public data?: ChunkData;
     public priority: number | null = null;
     public orderKey: number | null = null;

     // Readonly metadata
     public readonly shape: ChunkShape;
     public readonly rowAlignmentBytes: TextureUnpackRowAlignment;
     public readonly chunkIndex: ChunkIndex;
     public readonly scale: ChunkScale;
     public readonly offset: ChunkOffset;

     private readonly observers_ = new Set<ChunkObserver>();

     constructor(params: ChunkParams) { ... }

     // Observable property accessors
     get state(): ChunkState { return this.state_; }
     set state(newState: ChunkState) {
       if (this.state_ !== newState) {
         const oldState = this.state_;
         this.state_ = newState;
         this.notifyStateChange(oldState, newState);
       }
     }

     // ... similar for visible, prefetch, lod

     addObserver(observer: ChunkObserver): void {
       this.observers_.add(observer);
     }

     removeObserver(observer: ChunkObserver): void {
       this.observers_.delete(observer);
     }
   }
   ```

4. Create `ChunkParams` type for constructor parameters
5. Keep backward compatibility where possible

### Phase 2: Simplify ChunkStatistics

**File**: `packages/core/src/core/chunk_statistics.ts`

1. Remove `AggregateStats` interface
2. Remove `aggregateStats_` property
3. Remove `getAggregateStats()` method
4. Remove aggregate tracking from all record methods
5. Implement `ChunkObserver` interface:
   ```typescript
   export class ChunkStatistics implements ChunkObserver {
     private perTimeStats_ = new Map<number, TimeIndexStatsImpl>();

     trackChunk(chunk: Chunk): void {
       chunk.addObserver(this);
       const timeStats = this.getOrCreateTimeStats(chunk.chunkIndex.t);
       timeStats.totalChunks++;
       // Initialize state counts
       this.incrementStateCount(timeStats, chunk.state);
     }

     untrackChunk(chunk: Chunk): void {
       chunk.removeObserver(this);
       const timeStats = this.perTimeStats_.get(chunk.chunkIndex.t);
       if (timeStats) {
         timeStats.totalChunks--;
         this.decrementStateCount(timeStats, chunk.state);
         // Handle visibility/prefetch decrements
       }
     }

     onStateChange(chunk: Chunk, oldState: ChunkState, newState: ChunkState): void {
       const timeStats = this.getOrCreateTimeStats(chunk.chunkIndex.t);
       this.decrementStateCount(timeStats, oldState);
       this.incrementStateCount(timeStats, newState);
     }

     onVisibilityChange(chunk: Chunk, visible: boolean): void {
       const timeStats = this.getOrCreateTimeStats(chunk.chunkIndex.t);
       const lodStats = timeStats.getOrCreateLODStats(chunk.lod);
       lodStats.visibleChunks += visible ? 1 : -1;
     }

     // Similar for onPrefetchChange and onLODChange
   }
   ```

6. Remove `recordChunkCreated()`, `recordChunkDisposed()`, `recordStateTransition()`, etc.
7. Add `trackChunk()` and `untrackChunk()` as the primary API

### Phase 3: Update ChunkManagerSource

**File**: `packages/core/src/core/chunk_manager_source.ts`

1. Update chunk creation to use `new Chunk(...)` instead of object literal
2. Call `statistics_.trackChunk(chunk)` after creating each chunk
3. Remove all manual `recordStateTransition()` calls
4. Remove all manual `recordVisibilityChange()` calls
5. Remove all manual `recordPrefetchChange()` calls
6. Remove all manual `recordLODChange()` calls
7. In `disposeChunk()`: call `statistics_.untrackChunk(chunk)` before disposal
8. Keep the `statistics` getter

**Key changes:**
```typescript
// Constructor: chunk creation
const chunk = new Chunk({
  state: "unloaded",
  lod,
  visible: false,
  prefetch: false,
  priority: null,
  orderKey: null,
  shape: { x, y, z, c },
  rowAlignmentBytes: 1,
  chunkIndex: { x, y, z, c, t },
  scale: { x, y, z },
  offset: { x, y, z },
});
chunksAtT.push(chunk);
this.statistics_.trackChunk(chunk);

// updateChunksAtTimeIndex: just assign properties
chunk.visible = isVisible;  // Automatically notifies observers
chunk.prefetch = eligibleForPrefetch && isCurrentLOD && !isLoaded;

if (chunk.priority !== null && chunk.state === "unloaded") {
  chunk.state = "queued";  // Automatically notifies observers
} else if (chunk.priority === null && chunk.state === "queued") {
  chunk.state = "unloaded";
  chunk.orderKey = null;
}

// disposeChunk: untrack before disposal
private disposeChunk(chunk: Chunk) {
  this.statistics_.untrackChunk(chunk);
  chunk.data = undefined;
  chunk.state = "unloaded";
  chunk.priority = null;
  chunk.orderKey = null;
  chunk.prefetch = false;
  chunk.visible = false;
}
```

### Phase 4: Update ChunkQueue

**File**: `packages/core/src/data/chunk_queue.ts`

1. Remove `StateChangeCallback` type
2. Remove `onStateChange_` property from constructor
3. Remove callback invocations in `start()` method
4. Keep direct state assignments (observers will be notified automatically)

```typescript
// Before:
const oldState = chunk.state;
chunk.state = "loading";
this.onStateChange_?.(chunk, oldState, "loading");

// After:
chunk.state = "loading";  // Observer is notified automatically
```

### Phase 5: Update ChunkManager

**File**: `packages/core/src/core/chunk_manager.ts`

1. Remove `chunkToSource_` Map (no longer needed)
2. Remove callback in `ChunkQueue` constructor
3. Remove `getAggregateStatistics()` method
4. Keep `getSources()` method for accessing per-source statistics

### Phase 6: Update ChunkInfoOverlay

**File**: `packages/core/examples/chunk_streaming/chunk_info_overlay.ts`

1. No changes needed - it already uses per-time statistics
2. If it previously used aggregate stats, update to use per-time

### Phase 7: Update Tests

**Files**:
- `test/chunk_statistics.test.ts`
- `test/chunk_manager_source_statistics.test.ts`
- `test/helpers.ts`

1. Update `makeChunk()` helper to create `Chunk` class instances
2. Remove aggregate statistics tests
3. Update tests to use observer pattern:
   ```typescript
   test("records state transition", () => {
     const stats = new ChunkStatistics();
     const chunk = makeChunk({ state: "unloaded", chunkIndex: { t: 0 } });

     stats.trackChunk(chunk);

     // Just change the state - observer is notified automatically
     chunk.state = "queued";

     const timeStats = stats.getStatsForTime(0);
     expect(timeStats.queuedChunks).toBe(1);
     expect(timeStats.unloadedChunks).toBe(0);
   });
   ```

4. Keep integration tests with ChunkManagerSource
5. Add tests for observer registration/unregistration

## Benefits of New Design

1. **Automatic tracking**: No manual calls to record methods needed
2. **Decoupled**: Statistics don't need to be passed around
3. **Simpler**: No aggregate stats complexity
4. **Type-safe**: Chunk is now a proper class with encapsulation
5. **Extensible**: Easy to add new observers (e.g., for debugging, logging)
6. **Less error-prone**: Can't forget to update statistics

## Potential Concerns

### Performance
- Observer notifications add small overhead (~1-2 method calls per property change)
- But we're already doing equivalent work with manual recording
- Net performance should be similar or slightly better (no callback lookups)

### Backward Compatibility
- Breaking change: Chunk is no longer a plain object
- All code creating chunks needs to use `new Chunk(...)`
- Spread operator won't work on Chunk anymore
- JSON serialization may need special handling

### Observer Lifecycle
- Must ensure observers are removed when no longer needed
- ChunkStatistics must be cleaned up when ChunkManagerSource is destroyed
- Risk of memory leaks if observers aren't removed

## Migration Checklist

- [ ] Phase 1: Convert Chunk type to class with observers
- [ ] Phase 2: Simplify ChunkStatistics (remove aggregates, add observer impl)
- [ ] Phase 3: Update ChunkManagerSource to use Chunk class and remove manual tracking
- [ ] Phase 4: Update ChunkQueue to remove callbacks
- [ ] Phase 5: Update ChunkManager to remove aggregate methods
- [ ] Phase 6: Verify ChunkInfoOverlay still works
- [ ] Phase 7: Update all tests
- [ ] Phase 8: Run full test suite
- [ ] Phase 9: Manual testing with examples
- [ ] Phase 10: Update plan documentation

## Open Questions

1. **Should we observe ALL property changes or just the ones affecting statistics?**
   - Probably just statistics-relevant ones (state, visible, prefetch, lod)

2. **How to handle chunk disposal?**
   - Call `untrackChunk()` before disposal
   - Or have a `dispose()` method on Chunk that notifies observers?

3. **Should Chunk.data changes be observable?**
   - Probably not needed for statistics
   - Could be useful for debugging/memory tracking

4. **How to handle ChunkQueue state transitions?**
   - ChunkQueue directly sets chunk.state, which triggers observers
   - No special handling needed

5. **Should we provide a way to temporarily disable observers?**
   - Could be useful for bulk operations
   - Probably not needed initially

6. **What about existing Zarr loaders that create chunks?**
   - Need to audit all places where chunks are created
   - Update to use Chunk constructor

## Estimated Effort

- Chunk class conversion: ~2-3 hours
- Statistics simplification: ~1 hour
- Update ChunkManagerSource: ~1-2 hours
- Update ChunkQueue: ~30 minutes
- Update tests: ~2-3 hours
- Manual testing: ~1 hour

**Total**: ~8-12 hours of development work
