// @ts-expect-error no types file for this module
import Stats from "./vendored/stats.js";

export function createStats({ scale } = { scale: 1.5 }): Stats {
  const stats = new Stats(scale);
  stats.showPanel(0 /* 0 = fps, 1 = ms, 2 = mb */);
  document.body.appendChild(stats.dom);
  return stats;
}

type StatsPanel = {
  dom: HTMLCanvasElement;
  update(value: number, maxValue: number): void;
};

export type Stats = {
  REVISION: number;
  dom: HTMLElement;
  domElement: HTMLElement; // backwards compatibility
  addPanel(panel: StatsPanel): StatsPanel;
  showPanel(id: number): void;
  setMode(id: number): void; // backwards compatibility
  begin(): void;
  end(): number;
  update(): void;
};
