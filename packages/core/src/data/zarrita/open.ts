import * as zarr from "zarrita";
import { Readable } from "@zarrita/storage";

export async function open_group(
  location: zarr.Location<Readable>
): Promise<zarr.Group<Readable>> {
  return zarr.open
    .v2(location, { kind: "group", attrs: false })
    .catch(() => {
      return zarr.open.v3(location, { kind: "group" });
    })
    .catch(() => {
      throw new Error(`Failed to open Zarr group at ${location}`);
    });
}

export async function open_array(
  location: zarr.Location<Readable>
): Promise<zarr.Array<zarr.DataType, Readable>> {
  return zarr.open
    .v2(location, { kind: "array", attrs: false })
    .catch(() => {
      return zarr.open.v3(location, { kind: "array" });
    })
    .catch(() => {
      throw new Error(`Failed to open Zarr group at ${location}`);
    });
}
