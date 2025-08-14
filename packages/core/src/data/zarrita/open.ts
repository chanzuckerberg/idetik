import * as zarr from "zarrita";
import { Readable } from "@zarrita/storage";

export type Version = "v2" | "v3";

export async function openGroup(
  location: zarr.Location<Readable>,
  version?: Version
): Promise<zarr.Group<Readable>> {
  if (version === "v2") {
    try {
      return zarr.open.v2(location, { kind: "group", attrs: true });
    } catch {
      throw new Error(`Failed to open Zarr v2 group at ${location}`);
    }
  }
  if (version === "v3") {
    try {
      return zarr.open.v3(location, { kind: "group" });
    } catch {
      throw new Error(`Failed to open Zarr v3 group at ${location}`);
    }
  }
  try {
    return zarr.open(location, { kind: "group" });
  } catch {
    throw new Error(`Failed to open Zarr group at ${location}`);
  }
}

export async function openArray(
  location: zarr.Location<Readable>,
  version?: Version
): Promise<zarr.Array<zarr.DataType, Readable>> {
  if (version === "v2") {
    try {
      return zarr.open.v2(location, { kind: "array", attrs: false });
    } catch {
      throw new Error(`Failed to open Zarr v2 array at ${location}`);
    }
  }
  if (version === "v3") {
    try {
      return zarr.open.v3(location, { kind: "array" });
    } catch {
      throw new Error(`Failed to open Zarr v3 array at ${location}`);
    }
  }
  try {
    return zarr.open(location, { kind: "array" });
  } catch {
    throw new Error(`Failed to open Zarr array at ${location}`);
  }
}
