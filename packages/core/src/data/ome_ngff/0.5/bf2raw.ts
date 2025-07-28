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
        /**The version of the OME-Zarr Metadata*/
        version: z
          .literal("0.5")
          .describe("The version of the OME-Zarr Metadata"),
      })
      .describe("The versioned OME-Zarr Metadata namespace"),
  })
  .describe("The zarr.json attributes key");
export type Bf2raw = z.infer<typeof Bf2raw>;
