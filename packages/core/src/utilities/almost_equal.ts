export function almostEqual(
  a: number,
  b: number,
  options: { absoluteTolerance?: number; relativeTolerance?: number } = {
    absoluteTolerance: 1e-6,
    relativeTolerance: 1e-9,
  }
): boolean {
  const absoluteTolerance = options.absoluteTolerance ?? 1e-6;
  const relativeTolerance = options.relativeTolerance ?? 1e-9;

  const absDiff = Math.abs(a - b);
  const relativeThreshold =
    relativeTolerance * Math.max(Math.abs(a), Math.abs(b));

  // Pass if within either tolerance
  return absDiff <= absoluteTolerance || absDiff <= relativeThreshold;
}
