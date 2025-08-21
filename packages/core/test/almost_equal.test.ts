import { expect, test } from "vitest";
import { almostEqual } from "../src/utilities/almost_equal";

test("almostEqual: absolute tolerance for small values", () => {
  expect(almostEqual(0.001, 0.0011, { absoluteTolerance: 1e-3 })).toBe(true);
  expect(almostEqual(0.001, 0.002, { absoluteTolerance: 1e-3 })).toBe(true); // 0.001 diff <= 1e-3 tolerance
  expect(almostEqual(0.001, 0.003, { absoluteTolerance: 1e-3 })).toBe(false); // 0.002 diff > 1e-3 tolerance
});

test("almostEqual: relative tolerance for large values", () => {
  expect(almostEqual(1000, 1000.001, { relativeTolerance: 1e-5 })).toBe(true);
  expect(almostEqual(1000, 1001, { relativeTolerance: 1e-5 })).toBe(false);
});

test("almostEqual: passes with either tolerance", () => {
  // Should pass if within either absolute OR relative tolerance
  expect(
    almostEqual(100, 100.01, {
      absoluteTolerance: 0.02,
      relativeTolerance: 1e-6,
    })
  ).toBe(true); // abs wins
  expect(
    almostEqual(10000, 10000.01, {
      absoluteTolerance: 1e-6,
      relativeTolerance: 1e-5,
    })
  ).toBe(true); // rel wins
});

test("almostEqual: identical values always pass", () => {
  expect(
    almostEqual(42, 42, { absoluteTolerance: 0, relativeTolerance: 0 })
  ).toBe(true);
});

test("almostEqual: uses default tolerances", () => {
  expect(almostEqual(1.0, 1.0000001)).toBe(true); // within default abs tolerance (1e-6)
  expect(almostEqual(1000000, 1000000.0001)).toBe(true); // within default rel tolerance (1e-9 * 1000000 = 1e-3)
});
