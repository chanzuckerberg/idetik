import { z } from "zod";

/**JSON from OME-Zarr zarr.json*/
export const Well = z
  .object({
    /**The versioned OME-Zarr Metadata namespace*/
    ome: z
      .object({
        well: z.object({
          /**The fields of view for this well*/
          images: z
            .array(
              z.object({
                /**A unique identifier within the context of the plate*/
                acquisition: z
                  .number()
                  .int()
                  .describe(
                    "A unique identifier within the context of the plate"
                  )
                  .optional(),
                /**The path for this field of view subgroup*/
                path: z
                  .string()
                  .regex(new RegExp("^[A-Za-z0-9]+$"))
                  .describe("The path for this field of view subgroup"),
              })
            )
            .min(1)
            .describe("The fields of view for this well"),
        }),
        version: z.any(),
      })
      .describe("The versioned OME-Zarr Metadata namespace"),
  })
  .describe("JSON from OME-Zarr zarr.json");
export type Well = z.infer<typeof Well>;
