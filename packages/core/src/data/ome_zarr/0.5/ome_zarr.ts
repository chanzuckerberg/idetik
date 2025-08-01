import { z } from "zod";

export const Ome_Zarr = z.union([
  z
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
    .describe("The zarr.json attributes key"),
  z
    .object({
      /**The versioned OME-Zarr Metadata namespace*/
      ome: z
        .object({
          /**The multiscale datasets for this image*/
          multiscales: z
            .array(
              z.object({
                name: z.string().optional(),
                datasets: z
                  .array(
                    z.object({
                      path: z.string(),
                      coordinateTransformations: z
                        .array(
                          z.any().superRefine((x, ctx) => {
                            const schemas = [
                              z.object({
                                type: z.literal("scale"),
                                scale: z.array(z.number()).min(2),
                              }),
                              z.object({
                                type: z.literal("translation"),
                                translation: z.array(z.number()).min(2),
                              }),
                            ];
                            const errors = schemas.reduce<z.ZodError[]>(
                              (errors, schema) =>
                                ((result) =>
                                  result.error
                                    ? [...errors, result.error]
                                    : errors)(schema.safeParse(x)),
                              []
                            );
                            if (schemas.length - errors.length !== 1) {
                              ctx.addIssue({
                                path: ctx.path,
                                code: "invalid_union",
                                unionErrors: errors,
                                message:
                                  "Invalid input: Should pass single schema",
                              });
                            }
                          })
                        )
                        .min(1),
                    })
                  )
                  .min(1),
                axes: z
                  .array(
                    z.any().superRefine((x, ctx) => {
                      const schemas = [
                        z.object({
                          name: z.string(),
                          type: z.enum(["channel", "time", "space"]),
                        }),
                        z.object({
                          name: z.string(),
                          type: z
                            .any()
                            .refine(
                              (value) =>
                                !z
                                  .enum(["space", "time", "channel"])
                                  .safeParse(value).success,
                              "Invalid input: Should NOT be valid against schema"
                            )
                            .optional(),
                        }),
                      ];
                      const errors = schemas.reduce<z.ZodError[]>(
                        (errors, schema) =>
                          ((result) =>
                            result.error ? [...errors, result.error] : errors)(
                            schema.safeParse(x)
                          ),
                        []
                      );
                      if (schemas.length - errors.length !== 1) {
                        ctx.addIssue({
                          path: ctx.path,
                          code: "invalid_union",
                          unionErrors: errors,
                          message: "Invalid input: Should pass single schema",
                        });
                      }
                    })
                  )
                  .min(2)
                  .max(5),
                coordinateTransformations: z
                  .array(
                    z.any().superRefine((x, ctx) => {
                      const schemas = [
                        z.object({
                          type: z.literal("scale"),
                          scale: z.array(z.number()).min(2),
                        }),
                        z.object({
                          type: z.literal("translation"),
                          translation: z.array(z.number()).min(2),
                        }),
                      ];
                      const errors = schemas.reduce<z.ZodError[]>(
                        (errors, schema) =>
                          ((result) =>
                            result.error ? [...errors, result.error] : errors)(
                            schema.safeParse(x)
                          ),
                        []
                      );
                      if (schemas.length - errors.length !== 1) {
                        ctx.addIssue({
                          path: ctx.path,
                          code: "invalid_union",
                          unionErrors: errors,
                          message: "Invalid input: Should pass single schema",
                        });
                      }
                    })
                  )
                  .min(1)
                  .optional(),
              })
            )
            .min(1)
            .describe("The multiscale datasets for this image"),
          omero: z
            .object({
              channels: z.array(
                z.object({
                  window: z
                    .object({
                      end: z.number(),
                      max: z.number(),
                      min: z.number(),
                      start: z.number(),
                    })
                    .optional(),
                  label: z.string().optional(),
                  family: z.string().optional(),
                  color: z.string().optional(),
                  active: z.boolean().optional(),
                })
              ),
            })
            .optional(),
          /**The version of the OME-Zarr Metadata*/
          version: z
            .literal("0.5")
            .describe("The version of the OME-Zarr Metadata"),
        })
        .describe("The versioned OME-Zarr Metadata namespace"),
    })
    .describe("The zarr.json attributes key"),
  z
    .object({
      /**The versioned OME-Zarr Metadata namespace*/
      ome: z
        .object({
          "image-label": z.object({
            /**The colors for this label image*/
            colors: z
              .array(
                z.object({
                  /**The value of the label*/
                  "label-value": z.number().describe("The value of the label"),
                  /**The RGBA color stored as an array of four integers between 0 and 255*/
                  rgba: z
                    .array(z.number().int().gte(0).lte(255))
                    .min(4)
                    .max(4)
                    .describe(
                      "The RGBA color stored as an array of four integers between 0 and 255"
                    )
                    .optional(),
                })
              )
              .min(1)
              .describe("The colors for this label image")
              .optional(),
            /**The properties for this label image*/
            properties: z
              .array(
                z.object({
                  /**The pixel value for this label*/
                  "label-value": z
                    .number()
                    .int()
                    .describe("The pixel value for this label"),
                })
              )
              .min(1)
              .describe("The properties for this label image")
              .optional(),
            /**The source of this label image*/
            source: z
              .object({ image: z.string().optional() })
              .describe("The source of this label image")
              .optional(),
          }),
          /**The version of the OME-Zarr Metadata*/
          version: z
            .literal("0.5")
            .describe("The version of the OME-Zarr Metadata"),
        })
        .describe("The versioned OME-Zarr Metadata namespace"),
    })
    .describe("The zarr.json attributes key"),
  z
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
          /**The version of the OME-Zarr Metadata*/
          version: z
            .literal("0.5")
            .describe("The version of the OME-Zarr Metadata"),
        })
        .describe("The versioned OME-Zarr Metadata namespace"),
    })
    .describe("The zarr.json attributes key"),
  z
    .object({
      /**The versioned OME-Zarr Metadata namespace*/
      ome: z
        .object({
          plate: z.object({
            /**The acquisitions for this plate*/
            acquisitions: z
              .array(
                z.object({
                  /**A unique identifier within the context of the plate*/
                  id: z
                    .number()
                    .int()
                    .gte(0)
                    .describe(
                      "A unique identifier within the context of the plate"
                    ),
                  /**The maximum number of fields of view for the acquisition*/
                  maximumfieldcount: z
                    .number()
                    .int()
                    .gt(0)
                    .describe(
                      "The maximum number of fields of view for the acquisition"
                    )
                    .optional(),
                  /**The name of the acquisition*/
                  name: z
                    .string()
                    .describe("The name of the acquisition")
                    .optional(),
                  /**The description of the acquisition*/
                  description: z
                    .string()
                    .describe("The description of the acquisition")
                    .optional(),
                  /**The start timestamp of the acquisition, expressed as epoch time i.e. the number seconds since the Epoch*/
                  starttime: z
                    .number()
                    .int()
                    .gte(0)
                    .describe(
                      "The start timestamp of the acquisition, expressed as epoch time i.e. the number seconds since the Epoch"
                    )
                    .optional(),
                  /**The end timestamp of the acquisition, expressed as epoch time i.e. the number seconds since the Epoch*/
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
            /**The maximum number of fields per view across all wells*/
            field_count: z
              .number()
              .int()
              .gt(0)
              .describe(
                "The maximum number of fields per view across all wells"
              )
              .optional(),
            /**The name of the plate*/
            name: z.string().describe("The name of the plate").optional(),
            /**The columns of the plate*/
            columns: z
              .array(
                z.object({
                  /**The column name*/
                  name: z
                    .string()
                    .regex(new RegExp("^[A-Za-z0-9]+$"))
                    .describe("The column name"),
                })
              )
              .min(1)
              .describe("The columns of the plate"),
            /**The rows of the plate*/
            rows: z
              .array(
                z.object({
                  /**The row name*/
                  name: z
                    .string()
                    .regex(new RegExp("^[A-Za-z0-9]+$"))
                    .describe("The row name"),
                })
              )
              .min(1)
              .describe("The rows of the plate"),
            /**The wells of the plate*/
            wells: z
              .array(
                z.object({
                  /**The path to the well subgroup*/
                  path: z
                    .string()
                    .regex(new RegExp("^[A-Za-z0-9]+/[A-Za-z0-9]+$"))
                    .describe("The path to the well subgroup"),
                  /**The index of the well in the rows list*/
                  rowIndex: z
                    .number()
                    .int()
                    .gte(0)
                    .describe("The index of the well in the rows list"),
                  /**The index of the well in the columns list*/
                  columnIndex: z
                    .number()
                    .int()
                    .gte(0)
                    .describe("The index of the well in the columns list"),
                })
              )
              .min(1)
              .describe("The wells of the plate"),
          }),
          /**The version of the OME-Zarr Metadata*/
          version: z
            .literal("0.5")
            .describe("The version of the OME-Zarr Metadata"),
        })
        .describe("The versioned OME-Zarr Metadata namespace"),
    })
    .describe("The zarr.json attributes key"),
  z
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
          /**The version of the OME-Zarr Metadata*/
          version: z
            .literal("0.5")
            .describe("The version of the OME-Zarr Metadata"),
        })
        .describe("The versioned OME-Zarr Metadata namespace"),
    })
    .describe("JSON from OME-Zarr zarr.json"),
]);
export type Ome_Zarr = z.infer<typeof Ome_Zarr>;
