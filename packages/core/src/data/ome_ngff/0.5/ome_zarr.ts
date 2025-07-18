import { z } from "zod";

export const Ome_Zarr = z.union([
  z.any(),
  z.any(),
  z.any(),
  z.any(),
  z.any(),
  z.any(),
]);
export type Ome_Zarr = z.infer<typeof Ome_Zarr>;
