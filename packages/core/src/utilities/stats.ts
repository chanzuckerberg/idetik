import Stats from "stats.js";

export function createStats(panel: 0 | 1 | 2 = 0) {
  const stats = new Stats();
  stats.showPanel(panel);
  document.body.appendChild(stats.dom);
  return stats;
}
