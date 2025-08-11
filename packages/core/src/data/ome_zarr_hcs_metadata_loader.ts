import * as zarr from "zarrita";
import { Plate } from "../data/ome_ngff/0.4/plate";
import { Well } from "../data/ome_ngff/0.4/well";
import { Image } from "../data/ome_ngff/0.4/image";
import { OmeZarrImageSource } from "./ome_zarr_image_source";

export async function loadOmeZarrPlate(url: string): Promise<Plate> {
  const store = new zarr.FetchStore(url);
  const group = await zarr.open.v2(store, { kind: "group" });
  // Will throw validation exceptions that we can catch if we want.
  return Plate.parse(group.attrs);
}

export async function loadOmeZarrWell(
  url: string,
  path: string
): Promise<Well> {
  const store = new zarr.FetchStore(url + "/" + path);
  const root = await zarr.open.v2(store, { kind: "group" });
  // Will throw validation exceptions that we can catch if we want.
  return Well.parse(root.attrs);
}

export type OmeroMetadata = NonNullable<Image["omero"]>;
export type OmeroChannel = OmeroMetadata["channels"][number];

export async function loadOmeroChannels(
  source: OmeZarrImageSource
): Promise<OmeroChannel[]> {
  const group = await zarr.open.v2(source.location, { kind: "group" });
  const metadata = Image.parse(group.attrs);
  return metadata.omero?.channels ?? [];
}

export async function loadOmeroDefaultZ(
  source: OmeZarrImageSource
): Promise<number> {
  const group = await zarr.open.v2(source.location, { kind: "group" });
  const metadata = Image.parse(group.attrs);
  return metadata.omero?.rdefs?.defaultZ ?? 0;
}
