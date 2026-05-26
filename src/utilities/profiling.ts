// Lightweight wrappers over `performance.mark` / `performance.measure` so
// instrumented call sites read as one-liners. Measurements show up in the
// browser DevTools Performance panel under "User Timing".
//
// `gpuProfilingEnabled` is a runtime toggle for inserting `gl.finish()` after
// GPU-bound calls — converts the upload's GPU completion time into wall-clock
// time the surrounding `profile()` block can capture. Forces a main-thread
// stall; only enable for diagnosis, never in production.

let gpuProfilingEnabled_ = false;

export function setGpuProfilingEnabled(enabled: boolean): void {
  gpuProfilingEnabled_ = enabled;
}

export function isGpuProfilingEnabled(): boolean {
  return gpuProfilingEnabled_;
}

let seq_ = 0;

export function profile<T>(name: string, fn: () => T): T {
  // Per-call unique mark name avoids collision when measurements are nested
  // or interleaved (the recorded `measure` event uses `name` as its label).
  const start = `${name}-start-${seq_++}`;
  performance.mark(start);
  try {
    return fn();
  } finally {
    performance.measure(name, start);
    performance.clearMarks(start);
  }
}

export async function profileAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = `${name}-start-${seq_++}`;
  performance.mark(start);
  try {
    return await fn();
  } finally {
    performance.measure(name, start);
    performance.clearMarks(start);
  }
}
