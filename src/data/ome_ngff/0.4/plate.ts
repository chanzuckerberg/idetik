import { z } from "zod";

export const Plate = z
  .object({
    plate: z
      .object({
        acquisitions: z
          .array(
            z.object({
              id: z
                .number()
                .int()
                .gte(0)
                .describe(
                  "A unique identifier within the context of the plate"
                ),
              maximumfieldcount: z
                .number()
                .int()
                .gt(0)
                .describe(
                  "The maximum number of fields of view for the acquisition"
                )
                .optional(),
              name: z
                .string()
                .describe("The name of the acquisition")
                .optional(),
              description: z
                .string()
                .describe("The description of the acquisition")
                .optional(),
              starttime: z
                .number()
                .int()
                .gte(0)
                .describe(
                  "The start timestamp of the acquisition, expressed as epoch time i.e. the number seconds since the Epoch"
                )
                .optional(),
              endtime: z
                .number()
                .int()
                .gte(0)
                .describe(
                  "The end timestamp of the acquisition, expressed as epoch time i.e. the number seconds since the Epoch"
                )
                .optional(),
            })
          )
          .describe("The acquisitions for this plate")
          .optional(),
        version: z
          .literal("0.4")
          .describe("The version of the specification")
          .optional(),
        field_count: z
          .number()
          .int()
          .gt(0)
          .describe("The maximum number of fields per view across all wells")
          .optional(),
        name: z.string().describe("The name of the plate").optional(),
        columns: z
          .array(
            z.object({
              name: z
                .string()
                .regex(new RegExp("^[A-Za-z0-9]+$"))
                .describe("The column name"),
            })
          )
          .min(1)
          .describe("The columns of the plate"),
        rows: z
          .array(
            z.object({
              name: z
                .string()
                .regex(new RegExp("^[A-Za-z0-9]+$"))
                .describe("The row name"),
            })
          )
          .min(1)
          .describe("The rows of the plate"),
        wells: z
          .array(
            z.object({
              path: z
                .string()
                .regex(new RegExp("^[A-Za-z0-9]+/[A-Za-z0-9]+$"))
                .describe("The path to the well subgroup"),
              rowIndex: z
                .number()
                .int()
                .gte(0)
                .describe("The index of the well in the rows list"),
              columnIndex: z
                .number()
                .int()
                .gte(0)
                .describe("The index of the well in the columns list"),
            })
          )
          .min(1)
          .describe("The wells of the plate"),
      })
      .optional(),
  })
  .describe("JSON from OME-NGFF .zattrs");
export type Plate = z.infer<typeof Plate>;
