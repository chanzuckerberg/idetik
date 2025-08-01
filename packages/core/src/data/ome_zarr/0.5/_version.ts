import { z } from "zod";

/**The version of the OME-Zarr Metadata*/
export const _Version = z
  .literal("0.5")
  .describe("The version of the OME-Zarr Metadata");
export type _Version = z.infer<typeof _Version>;
