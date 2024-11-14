// The semi-closed interval [start, stop).
export type Interval = {
  start: number;
  stop: number;
};

// A region of some labelled space that can be used for indexing.
export type Region = Map<string, Interval | number>;

// An axis-aligned bounding box in some labelled space.
export type Box = Map<string, Interval>;
