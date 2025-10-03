// duplicated from stats.d.ts to avoid type errors (needed for build)
export type StatsPanel = {
  dom: HTMLCanvasElement;
  update(value: number, maxValue: number): void;
};

export interface Stats {
  REVISION: number;
  dom: HTMLElement;
  domElement: HTMLElement; // backwards compat
  addPanel(panel: StatsPanel): StatsPanel;
  showPanel(id: number): void;
  setMode(id: number): void; // backwards compat
  begin(): void;
  end(): number;
  update(): void;
}

export interface StatsConstructor {
  new (scale?: number): Stats;
  (scale?: number): Stats;
  Panel: {
    new (name: string, fg: string, bg: string, scale: number): StatsPanel;
    (name: string, fg: string, bg: string, scale: number): StatsPanel;
  };
}

declare const Stats: StatsConstructor;
export default Stats;
