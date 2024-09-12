// The semi-closed interval [start, stop).
export class Interval {
  readonly start_: number;
  readonly stop_: number;

  constructor(start: number, stop: number) {
    this.start_ = start;
    this.stop_ = stop;
  }

  public get start(): number {
    return this.start_;
  }

  public get stop(): number {
    return this.stop_;
  }
}

// An index for a specific dimension or axis in a region.
// TODO: add a unit for the index value(s).
export interface RegionIndex {
  dimension: string;
  index: Interval | number;
}

// A region of some dimensional space.
export type Region = Array<RegionIndex>;
