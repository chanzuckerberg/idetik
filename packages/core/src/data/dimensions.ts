export type DimensionProps = {
  name: string;
};

export type Dimension = {
  name: string;
  index: number;
  length: number;
  unit?: string;
};

export type DimensionMappingProps = {
  x: DimensionProps;
  y: DimensionProps;
  z?: DimensionProps;
  c?: DimensionProps;
  t?: DimensionProps;
};

export type DimensionMapping = {
  x: Dimension;
  y: Dimension;
  z?: Dimension;
  c?: Dimension;
  t?: Dimension;
};

export type VirtualCamera2D = {
  x: { start: number; end: number };
  y: { start: number; end: number };
  z?: number;
  c?: number;
  t?: number;
  lod?: number;
};
