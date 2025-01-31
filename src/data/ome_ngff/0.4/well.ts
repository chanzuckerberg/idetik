import { z } from "zod";

export const Well = z
  .object({
    well: z
      .object({
        images: z
          .array(
            z.object({
              acquisition: z
                .number()
                .int()
                .describe("A unique identifier within the context of the plate")
                .optional(),
              path: z
                .string()
                .regex(new RegExp("^[A-Za-z0-9]+$"))
                .describe("The path for this field of view subgroup"),
            })
          )
          .min(1)
          .describe("The fields of view for this well"),
        version: z
          .literal("0.4")
          .describe("The version of the specification")
          .optional(),
      })
      .optional(),
  })
  .describe("JSON from OME-NGFF .zattrs");
export type Well = z.infer<typeof Well>;
