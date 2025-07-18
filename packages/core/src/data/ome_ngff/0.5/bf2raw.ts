import { z } from "zod";

/**The zarr.json attributes key*/
export const Bf2raw = z
  .object({
    /**The versioned OME-Zarr Metadata namespace*/
    ome: z
      .object({
        /**The top-level identifier metadata added by bioformats2raw*/
        "bioformats2raw.layout": z
          .literal(3)
          .describe(
            "The top-level identifier metadata added by bioformats2raw"
          ),
        version: z.any(),
      })
      .describe("The versioned OME-Zarr Metadata namespace"),
  })
  .describe("The zarr.json attributes key");
export type Bf2raw = z.infer<typeof Bf2raw>;
