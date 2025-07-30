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
  lut?: ReadonlyMap<number, ColorLike>
): ReadonlyMap<number, Color> {
  lut = lut ?? new Map();
  return new Map(
    Array.from(lut.entries()).map(([key, value]) => [key, Color.from(value)])
  );
}

function validateCycle(cycle?: ReadonlyArray<ColorLike>): ReadonlyArray<Color> {
  cycle = cycle ?? defaultColorCycle;
  return cycle.map(Color.from);
}

type LabelColorMapProps = {
  lookUpTable?: ReadonlyMap<number, ColorLike>;
  cycle?: ColorLike[];
};

export class LabelColorMap {
  public readonly lookUpTable: ReadonlyMap<number, Color>;
  public readonly cycle: ReadonlyArray<Color>;

  constructor(props: LabelColorMapProps = {}) {
    this.lookUpTable = validateLookupTable(props.lookUpTable);
    this.cycle = validateCycle(props.cycle);
  }
}
