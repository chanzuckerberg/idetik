import { Color, ColorLike } from "../../core/color";

const defaultColorCycle: ColorLike[] = [
  [1.0, 0.5, 0.5],
  [0.5, 1.0, 0.5],
  [0.5, 0.5, 1.0],
  [0.5, 1.0, 1.0],
  [1.0, 0.5, 1.0],
  [1.0, 1.0, 0.5],
];

function validateLookupTable(
  lookupTable?: ReadonlyMap<number, ColorLike>
): ReadonlyMap<number, Color> {
  lookupTable = lookupTable ?? new Map();
  return new Map(
    Array.from(lookupTable.entries()).map(([key, value]) => [
      key,
      Color.from(value),
    ])
  );
}

function validateCycle(cycle?: ReadonlyArray<ColorLike>): ReadonlyArray<Color> {
  cycle = cycle ?? defaultColorCycle;
  return cycle.map(Color.from);
}

export type LabelColorMapProps = {
  lookupTable?: ReadonlyMap<number, ColorLike>;
  cycle?: ColorLike[];
};

export class LabelColorMap {
  public readonly lookupTable: ReadonlyMap<number, Color>;
  public readonly cycle: ReadonlyArray<Color>;

  constructor(props: LabelColorMapProps = {}) {
    this.lookupTable = validateLookupTable(props.lookupTable);
    this.cycle = validateCycle(props.cycle);
  }
}
