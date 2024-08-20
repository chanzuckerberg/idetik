import { expect, test } from "vitest";

import { LayerManager } from "@";

test("Instantiate LayerManager", () => {
  const layerManager = new LayerManager();
  expect(layerManager).toBeDefined();
});
