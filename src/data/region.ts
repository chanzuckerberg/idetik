// The semi-closed interval [start, stop).
export type Point = {
  type: "point";
  value: number;
};

export type Interval = {
  type: "interval";
  start: number;
  stop: number;
};

export type Full = {
  type: "full";
};

export type Index = Point | Interval | Full;

// An index for a specific dimension or axis in a region.
// TODO: add a unit for the index value(s).
// https://github.com/chanzuckerberg/idetik/issues/36
export type DimensionalIndex = {
  dimension: string;
  index: Index;
};

// A region of some dimensional space.
export type Region = Array<DimensionalIndex>;
