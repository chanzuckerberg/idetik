# Plan: Efficient Chunk Statistics Tracking System

## Current Problem

**ChunkInfoOverlay** iterates over ALL chunks at the current time point on every frame (~60fps):
- Iterates through `getChunksAtCurrentTime()` to count loaded/loading/visible/prefetched chunks
- Iterates through `getChunks()` to count rendered chunks per LOD
- This is **O(n) per frame** where n = number of chunks at current time

## Proposed Solution: Event-Driven Statistics Tracker

Create a **`ChunkStatistics`** class that:
1. Maintains counters that are incremented/decremented as chunk state changes
2. Lives in the core alongside `ChunkManager` and `ChunkManagerSource`
3. Listens to chunk lifecycle events rather than polling
4. Provides **O(1)** access to statistics

---

## Architecture Design

### 1. New `ChunkStatistics` Class

**Location:** `packages/core/src/core/chunk_statistics.ts`

**Responsibilities:**
- Maintain counters for chunk states and properties
- Provide methods to increment/decrement counters atomically
- Expose current statistics via getter methods
- Track statistics per-source and aggregated across all sources

**Data Structure:**
```typescript
class ChunkStatistics {
  // Per time-index statistics
  private perTimeStats_: Map<number, TimeIndexStats>;

  // Aggregated statistics (across all time indices)
  private aggregateStats_: AggregateStats;
}

interface TimeIndexStats {
  totalChunks: number;

  // By state
  unloadedChunks: number;
  queuedChunks: number;
  loadingChunks: number;
  loadedChunks: number;

  // Per LOD breakdown
  perLOD: Map<number, LODStats>;
}

interface LODStats {
  visibleChunks: number;
  prefetchedChunks: number;
  renderedChunks: number;
}

interface AggregateStats {
  totalChunks: number;
  loadedChunks: number;
  loadingChunks: number;
  queuedChunks: number;
  unloadedChunks: number;
}
```

### 2. Integration Points

**Track chunk changes at these locations:**

#### A. **ChunkManagerSource** - Primary integration point
- When creating chunks initially (constructor)
- When updating chunk properties in `updateChunksAtTimeIndex()`:
  - State transitions (unloaded ↔ queued)
  - Visibility changes (`chunk.visible`)
  - Prefetch changes (`chunk.prefetch`)
  - Priority changes (indicates LOD/role changes)
- When disposing chunks in `disposeChunk()`
- When disposing time indices in `disposeStaleTimeChunks()`

#### B. **ChunkQueue** - State transitions
- When transitioning queued → loading (in `start()`)
- When transitioning loading → loaded (promise success)
- When transitioning loading → unloaded (promise failure)

#### C. **ChunkedImageLayer** (optional for rendered stats)
- When adding chunks to `visibleChunks_` Map
- When removing chunks from `visibleChunks_` Map

---

## Implementation Strategy

### Phase 1: Core Statistics Tracker

**1. Create `ChunkStatistics` class**
- Initialize per-time and aggregate counters
- Implement increment/decrement methods:
  ```typescript
  recordStateTransition(chunk: Chunk, oldState: ChunkState, newState: ChunkState): void
  recordVisibilityChange(chunk: Chunk, visible: boolean): void
  recordPrefetchChange(chunk: Chunk, prefetch: boolean): void
  recordLODChange(chunk: Chunk, oldLOD: number, newLOD: number): void
  recordRenderedChange(chunk: Chunk, rendered: boolean): void
  ```
- Implement getters:
  ```typescript
  getStatsForTime(timeIndex: number): TimeIndexStats
  getAggregateStats(): AggregateStats
  getStatsForCurrentTime(currentTimeIndex: number): CurrentTimeStats
  ```

**2. Add statistics instance to `ChunkManagerSource`**
```typescript
class ChunkManagerSource {
  private readonly statistics_ = new ChunkStatistics();

  public get statistics(): ChunkStatistics {
    return this.statistics_;
  }
}
```

### Phase 2: Instrument Chunk Lifecycle Events

**3. Instrument `ChunkManagerSource.constructor`**
- Initialize statistics with all chunks in "unloaded" state
- Record initial chunk counts per time index

**4. Instrument `ChunkManagerSource.updateChunksAtTimeIndex()`**
Around lines 321-366 where chunk properties change:
```typescript
// Before changing properties, capture old values
const oldVisible = chunk.visible;
const oldPrefetch = chunk.prefetch;
const oldState = chunk.state;
const oldLOD = chunk.lod;

// ... existing logic that modifies chunk properties ...

// After changes, record transitions
if (oldState !== chunk.state) {
  this.statistics_.recordStateTransition(chunk, oldState, chunk.state);
}
if (oldVisible !== chunk.visible) {
  this.statistics_.recordVisibilityChange(chunk, chunk.visible);
}
if (oldPrefetch !== chunk.prefetch) {
  this.statistics_.recordPrefetchChange(chunk, chunk.prefetch);
}
if (oldLOD !== chunk.lod) {
  this.statistics_.recordLODChange(chunk, oldLOD, chunk.lod);
}
```

**5. Instrument `ChunkManagerSource.disposeChunk()`**
Before clearing chunk data:
```typescript
disposeChunk(chunk: Chunk): void {
  if (chunk.state !== "unloaded") {
    this.statistics_.recordStateTransition(chunk, chunk.state, "unloaded");
  }
  if (chunk.visible) {
    this.statistics_.recordVisibilityChange(chunk, false);
  }
  if (chunk.prefetch) {
    this.statistics_.recordPrefetchChange(chunk, false);
  }
  // ... existing disposal logic ...
}
```

**6. Instrument `ChunkQueue.start()`**
Around lines 88-100 where state transitions occur:
```typescript
private start(item: ChunkQueueItem): void {
  const chunk = item.chunk;

  // Record queued → loading
  this.recordStateChange(chunk, "queued", "loading");

  item.fn(item.signal).then(
    () => {
      // Record loading → loaded
      this.recordStateChange(chunk, "loading", "loaded");
    },
    () => {
      // Record loading → unloaded
      this.recordStateChange(chunk, "loading", "unloaded");
    }
  );
}
```

**Challenge:** `ChunkQueue` doesn't have direct access to `ChunkStatistics`. Options:
- **Option A:** Pass statistics instance to queue
- **Option B:** Use callback pattern: `enqueue(chunk, loaderFn, onStateChange?)`
- **Option C:** Let ChunkManagerSource track these transitions by listening to chunk state

**Recommendation:** Option C - Have `ChunkManagerSource` check state changes after queue operations

### Phase 3: Aggregate Statistics in ChunkManager

**7. Add aggregation to `ChunkManager`**
```typescript
class ChunkManager {
  public getAggregateStatistics(): AggregateStats {
    // Aggregate across all sources
    const stats = new AggregateStats();
    for (const source of this.sources_) {
      const sourceStats = source.statistics.getAggregateStats();
      stats.merge(sourceStats);
    }
    return stats;
  }

  public getStatisticsForCurrentTime(): Map<ChunkManagerSource, CurrentTimeStats> {
    const result = new Map();
    for (const source of this.sources_) {
      result.set(source, source.statistics.getStatsForCurrentTime(source.currentTimeIndex));
    }
    return result;
  }
}
```

### Phase 4: Update ChunkInfoOverlay

**8. Refactor `ChunkInfoOverlay.update()`**
Replace iteration-based counting with statistics queries:
```typescript
public update(idetik: Idetik, _timestamp?: DOMHighResTimeStamp): void {
  const chunkManager = idetik.chunkManager;
  const stats = chunkManager.getAggregateStatistics();
  const currentTimeStats = chunkManager.getStatisticsForCurrentTime();

  // O(1) access instead of O(n) iteration
  const totalChunks = stats.totalChunks;
  const loadedChunks = stats.loadedChunks;
  const loadingChunks = stats.loadingChunks;

  // Per-LOD stats from currentTimeStats
  // ...

  // GPU texture memory still comes from textureInfo
  const { textures, totalBytes } = idetik.textureInfo;

  // Update UI
}
```

---

## Key Design Considerations

### 1. **Thread Safety / Atomicity**
Since JavaScript is single-threaded, no locking needed. Just ensure increment/decrement operations are atomic.

### 2. **Memory Overhead**
- Per-time statistics: ~O(T × L) where T = time points, L = LOD levels
- For typical use (T=10-100, L=3-5): negligible overhead
- Could add option to only track current time index if needed

### 3. **Correctness Verification**
Add debug mode that compares tracked statistics with actual iteration:
```typescript
if (DEBUG) {
  const trackedStats = this.statistics_.getStatsForTime(t);
  const actualStats = this.computeStatsByIteration(t);
  assert(trackedStats.equals(actualStats), "Statistics mismatch!");
}
```

### 4. **Rendered Chunks Tracking**
**Challenge:** Rendered chunks are determined by `ChunkedImageLayer.getChunks()` which filters `visibleChunks_` by frustum culling.

**Options:**
- **Option A:** Track in layer when chunks are added/removed from rendered set
- **Option B:** Keep this as lightweight iteration (usually small set of rendered chunks)
- **Option C:** Have statistics track "potentially visible" vs "actually rendered"

**Recommendation:** Option B initially - rendered set is typically small (< 100 chunks)

### 5. **Time Index Changes**
When current time index changes:
- Old time index statistics remain valid
- New time index statistics should already be maintained
- Need to track "current time" in statistics for efficient queries

### 6. **Disposal of Time Indices**
When `disposeStaleTimeChunks()` is called:
```typescript
private disposeStaleTimeChunks(...): void {
  for (const t of timesToDispose) {
    // Dispose chunks
    for (const chunk of this.chunks_[t]) {
      this.disposeChunk(chunk); // Already records in statistics
    }
    // Clean up statistics for this time index
    this.statistics_.disposeTimeIndex(t);
  }
}
```

---

## Benefits

1. **Performance:** O(1) statistics access instead of O(n) iteration per frame
2. **Accuracy:** Real-time statistics updated exactly when changes occur
3. **Extensibility:** Easy to add new statistics (e.g., memory usage, load times)
4. **Debuggability:** Can verify statistics correctness in debug mode
5. **Separation of Concerns:** Statistics tracking is separate from rendering/UI

---

## Migration Strategy

1. **Phase 1:** Implement `ChunkStatistics` class with tests
2. **Phase 2:** Instrument core chunk lifecycle in `ChunkManagerSource`
3. **Phase 3:** Add validation layer (compare tracked vs. computed stats)
4. **Phase 4:** Update `ChunkInfoOverlay` to use new statistics API
5. **Phase 5:** Remove validation layer once confident in correctness

---

## Alternative: Event Emitter Pattern

Instead of direct calls to `statistics_`, could use an event emitter:
```typescript
class ChunkManagerSource extends EventEmitter {
  private emitChunkChange(event: ChunkChangeEvent): void {
    this.emit('chunkChange', event);
  }
}

class ChunkStatistics {
  constructor(source: ChunkManagerSource) {
    source.on('chunkChange', (event) => this.handleChunkChange(event));
  }
}
```

**Trade-offs:**
- ✅ More decoupled
- ✅ Easier to add multiple listeners
- ❌ More overhead per event
- ❌ More complex debugging
- ❌ Need to manage listener lifecycle

**Recommendation:** Direct method calls initially for simplicity; can refactor to events later if needed.

---

## Estimated Complexity

- **ChunkStatistics class:** ~300-400 lines
- **Instrumentation in ChunkManagerSource:** ~50-100 lines of changes
- **ChunkManager aggregation:** ~50 lines
- **ChunkInfoOverlay refactor:** ~50 lines (simpler than before!)
- **Tests:** ~200-300 lines

**Total:** ~650-900 lines of new/modified code

This plan provides an efficient, maintainable way to track chunk statistics in real-time with minimal performance overhead. The statistics would be updated incrementally as chunks change state, eliminating the need for expensive iteration on every frame.
