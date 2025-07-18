import { z } from "zod";

/**The zarr.json attributes key*/
export const Ome = z
  .object({
    /**The versioned OME-Zarr Metadata namespace*/
    ome: z
      .object({
        /**An array of the same length and the same order as the images defined in the OME-XML*/
        series: z
          .array(z.string())
          .describe(
            "An array of the same length and the same order as the images defined in the OME-XML"
          ),
        version: z.any(),
      })
      .describe("The versioned OME-Zarr Metadata namespace"),
  })
  .describe("The zarr.json attributes key");
export type Ome = z.infer<typeof Ome>;
