import { z } from "zod";

/**JSON from OME-NGFF .zattrs*/
export const Image = z
  .object({
    /**The multiscale datasets for this image*/
    multiscales: z
      .array(
        z.object({
          name: z.string().optional(),
          datasets: z
            .array(
              z.object({ path: z.string(), coordinateTransformations: z.any() })
            )
            .min(1),
          version: z.literal("0.4").optional(),
          axes: z.any(),
          coordinateTransformations: z.any().optional(),
        })
      )
      .min(1)
      .describe("The multiscale datasets for this image"),
    omero: z
      .object({
        channels: z.array(
          z.object({
            window: z.object({
              end: z.number(),
              max: z.number(),
              min: z.number(),
              start: z.number(),
            }),
            label: z.string().optional(),
            family: z.string().optional(),
            color: z.string(),
            active: z.boolean().optional(),
          })
        ),
      })
      .optional(),
  })
  .describe("JSON from OME-NGFF .zattrs");
export type Image = z.infer<typeof Image>;
