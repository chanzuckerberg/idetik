import Stats from "stats.js";

export function createStats() {
  const stats = new Stats();
  stats.showPanel(0 /* 0 = fps, 1 = ms, 2 = mb */);
  document.body.appendChild(stats.dom);
  return stats;
}
