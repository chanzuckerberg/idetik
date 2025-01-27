import * as zarr from "zarrita";
import { OMENGFFPlateSchema } from "data/zarr/0.4/plate";
import { OMENGFFWellSchema } from "data/zarr/0.4/well";
import wellSchemaJson from './zarr/0.4/schemas/well.schema?raw'
import plateSchemaJson from './zarr/0.4/schemas/plate.schema?raw'
import Ajv2020, { JSONSchemaType } from "ajv/dist/2020"
const ajv = new Ajv2020()


const well_schema: JSONSchemaType<OMENGFFWellSchema> = JSON.parse(wellSchemaJson)
const plate_schema: JSONSchemaType<OMENGFFWellSchema> = JSON.parse(plateSchemaJson)

const validate_well = ajv.compile(well_schema)
const validate_plate = ajv.compile(plate_schema)

export async function loadOmeZarrPlate(url: string): Promise<OMENGFFPlateSchema> {
  const store = new zarr.FetchStore(url);
  const group = await zarr.open.v2(store, { kind: "group" });
  if (validate_plate(group.attrs)) {
    console.log("Plate Validation successful!")
  } else {
    console.log("Plate Validation failed!")
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
    console.log("Well Validation successful!")
  } else {
    console.log("Well Validation failed!")
  }

  return root.attrs as OMENGFFWellSchema;
}
