import * as zarr from "zarrita";
import { Plate } from "data/ome_ngff/0.4/plate";
import { Well } from "data/ome_ngff/0.4/well";
import { Image } from "data/ome_ngff/0.4/image";

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

export async function loadOmeroChannels(url: string): Promise<OmeroChannel[]> {
  const store = new zarr.FetchStore(url);
  const group = await zarr.open.v2(store, { kind: "group" });
  const metadata = Image.parse(group.attrs);
  return metadata.omero?.channels ?? [];
}
