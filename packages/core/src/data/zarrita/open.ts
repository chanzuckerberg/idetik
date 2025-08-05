import * as zarr from "zarrita";
import { Readable } from "@zarrita/storage";

export async function openGroup(
  location: zarr.Location<Readable>,
  version?: "v2" | "v3"
): Promise<zarr.Group<Readable>> {
  if (version === "v2") {
    return await openGroupV2(location);
  } else if (version === "v3") {
    return await openGroupV3(location);
  }
  try {
    return await openGroupV2(location);
  } catch {
    // Intentional fallthrough to v3
  }
  try {
    return await openGroupV3(location);
  } catch {
    // Intentional fallthrough to error
  }
  throw new Error(`Failed to open Zarr group at ${location}`);
}

async function openGroupV2(
  location: zarr.Location<Readable>
): Promise<zarr.Group<Readable>> {
  try {
    return await zarr.open.v2(location, { kind: "group", attrs: true });
  } catch {
    // Intentional fallthrough to error
  }
  throw new Error(`Failed to open Zarr v2 group at ${location}`);
}

async function openGroupV3(
  location: zarr.Location<Readable>
): Promise<zarr.Group<Readable>> {
  try {
    return await zarr.open.v3(location, { kind: "group" });
  } catch {
    // Intentional fallthrough to error
  }
  throw new Error(`Failed to open Zarr v3 group at ${location}`);
}

export async function openArray(
  location: zarr.Location<Readable>,
  version?: "v2" | "v3"
): Promise<zarr.Array<zarr.DataType, Readable>> {
  if (version === "v2") {
    return await openArrayV2(location);
  } else if (version === "v3") {
    return await openArrayV3(location);
  }
  try {
    return await openArrayV2(location);
  } catch {
    // Intentional fallthrough to v3
  }
  try {
    return await openArrayV3(location);
  } catch {
    // Intentional fallthrough to error
  }
  throw new Error(`Failed to open Zarr array at ${location}`);
}

async function openArrayV2(location: zarr.Location<Readable>) {
  try {
    return await zarr.open.v2(location, { kind: "array", attrs: false });
  } catch {
    // Intentional fallthrough to error
  }
  throw new Error(`Failed to open Zarr v2 array at ${location}`);
}

async function openArrayV3(location: zarr.Location<Readable>) {
  try {
    return await zarr.open.v3(location, { kind: "array" });
  } catch {
    // Intentional fallthrough to error
  }
  throw new Error(`Failed to open Zarr v3 array at ${location}`);
}
