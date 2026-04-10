import Stats, { type Stats as StatsType } from "./vendored/stats.js";

export function createStats({ scale } = { scale: 1.5 }): StatsType {
  const stats = new Stats(scale);
  stats.showPanel(0 /* 0 = fps, 1 = ms, 2 = mb */);
  document.body.appendChild(stats.dom);
  return stats;
}

// Re-export types from the vendored module
export type { Stats, StatsPanel } from "./vendored/stats.js";
