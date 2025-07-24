import * as zarr from "zarrita";
import { Plate } from "../data/ome_ngff/0.4/plate";
import { Well } from "../data/ome_ngff/0.4/well";
import { Image } from "../data/ome_ngff/0.4/image";
import { Readable } from "@zarrita/storage";

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
  const metadata = parseOmeNgffImage(group);
  return metadata.omero?.channels ?? [];
}

export async function loadOmeroDefaultZ(url: string): Promise<number> {
  const store = new zarr.FetchStore(url);
  const group = await zarr.open.v2(store, { kind: "group" });
  // @ts-expect-error rdefs is not in the provided schema
  return group.attrs?.omero?.rdefs?.defaultZ ?? 0;
}

export function parseOmeNgffImage(group: zarr.Group<Readable>): Image {
  // copy attrs to avoid mutating the original
  const attrs = { ...group.attrs };
  // TODO: silly fix for removing top-level identity transform,
  // which is not allowed by spec but may have been written by
  // some writers.
  // This may need to be done for top-level `coordinateTransformations` as well.
  // https://github.com/ome/ngff/pull/152
  if (
    Array.isArray(attrs?.multiscales) &&
    Array.isArray(attrs.multiscales[0]?.coordinateTransformations) &&
    attrs.multiscales[0].coordinateTransformations[0]?.type === "identity"
  ) {
    delete attrs.multiscales[0].coordinateTransformations;
  }
  return Image.parse(attrs);
}
