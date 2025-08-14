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

// A set of indices that maps from an n-dimensional source to 2D.
export type Region2DProps = {
  x?: Interval | Full;
  y?: Interval | Full;
  c?: Point | Full;
  z?: Point;
  t?: Point;
};

export class Region2D {
  public readonly x: Interval | Full;
  public readonly y: Interval | Full;
  public readonly c: Point | Full;
  public readonly z?: Point;
  public readonly t?: Point;

  constructor(props: Region2DProps) {
    this.x = props.x ?? { type: "full" };
    this.y = props.y ?? { type: "full" };
    this.c = props.c ?? { type: "full" };
    this.z = props.z;
    this.t = props.t;
  }
}
