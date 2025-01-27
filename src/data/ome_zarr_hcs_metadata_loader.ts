import * as zarr from "zarrita";
import Ajv2020, { JSONSchemaType } from "ajv/dist/2020";
import { OMENGFFPlateSchema } from "data/zarr/0.4/plate";
import { OMENGFFWellSchema } from "data/zarr/0.4/well";
import wellSchemaJson from "./zarr/0.4/schemas/well.schema?raw";
import plateSchemaJson from "./zarr/0.4/schemas/plate.schema?raw";

// TODO: we can initialize ajv and compile schemas at any point during application startup,
// it's just here as a quick example of how to work with it.
const ajv = new Ajv2020();
const well_schema: JSONSchemaType<OMENGFFWellSchema> =
  JSON.parse(wellSchemaJson);
const plate_schema: JSONSchemaType<OMENGFFWellSchema> =
  JSON.parse(plateSchemaJson);
// We could cache these compiled schemas as part of the `ajv` object and export that
// object for use by other modules, if we want: https://ajv.js.org/guide/managing-schemas.html#using-ajv-instance-cache
// Alternatively, we could codegen validators to reduce dependencies for this app: https://ajv.js.org/standalone.html
const validate_well = ajv.compile(well_schema);
const validate_plate = ajv.compile(plate_schema);

export async function loadOmeZarrPlate(
  url: string
): Promise<OMENGFFPlateSchema> {
  const store = new zarr.FetchStore(url);
  const group = await zarr.open.v2(store, { kind: "group" });
  if (validate_plate(group.attrs)) {
    console.log("Plate Data Validation successful!");
  } else {
    console.log("Plate Data Validation failed!");
  }
  return group.attrs as OMENGFFPlateSchema;
}

export async function loadOmeZarrWell(
  url: string,
  path: string
): Promise<OMENGFFWellSchema> {
  const store = new zarr.FetchStore(url + "/" + path);
  const root = await zarr.open.v2(store, { kind: "group" });
  if (validate_well(root.attrs)) {
    console.log("Well Data Validation successful!");
  } else {
    console.log("Well Data Validation failed!");
  }

  return root.attrs as OMENGFFWellSchema;
}
