import { Color, ColorLike } from "../../core/color";

const defaultColorCycle: ColorLike[] = [
  [1.0, 0.5, 0.5],
  [0.5, 1.0, 0.5],
  [0.5, 0.5, 1.0],
  [0.5, 1.0, 1.0],
  [1.0, 0.5, 1.0],
  [1.0, 1.0, 0.5],
];

type LabelColorMapProps = {
  lut?: ReadonlyMap<number, ColorLike>;
  cycle?: ColorLike[];
};

export class LabelColorMap {
  public readonly lut: ReadonlyMap<number, Color>;
  public readonly cycle: ReadonlyArray<Color>;

  constructor(props: LabelColorMapProps = {}) {
    this.lut = LabelColorMap.validateColorLut(props.lut);
    this.cycle = LabelColorMap.validateColorCycle(props.cycle);
  }

  private static validateColorLut(
    lut?: ReadonlyMap<number, ColorLike>
  ): ReadonlyMap<number, Color> {
    lut = lut ?? new Map();
    return new Map(
      Array.from(lut.entries()).map(([key, value]) => [key, Color.from(value)])
    );
  }

  private static validateColorCycle(
    cycle?: ReadonlyArray<ColorLike>
  ): ReadonlyArray<Color> {
    cycle = cycle ?? defaultColorCycle;
    return cycle.map(Color.from);
  }
}
