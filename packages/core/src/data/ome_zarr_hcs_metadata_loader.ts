import * as zarr from "zarrita";
import { Plate } from "../data/ome_ngff/0.5/plate";
import { Well } from "../data/ome_ngff/0.5/well";
import { Image as ImageV05 } from "../data/ome_ngff/0.5/image";
import { Image as ImageV04 } from "../data/ome_ngff/0.4/image";

export async function loadOmeZarrPlate(url: string): Promise<Plate> {
  const store = new zarr.FetchStore(url);
  const group = await zarr.open(store, { kind: "group" });
  // Will throw validation exceptions that we can catch if we want.
  return Plate.parse(group.attrs);
}

export async function loadOmeZarrWell(
  url: string,
  path: string
): Promise<Well> {
  const store = new zarr.FetchStore(url + "/" + path);
  const root = await zarr.open(store, { kind: "group" });
  // Will throw validation exceptions that we can catch if we want.
  return Well.parse(root.attrs);
}

export type OmeroMetadata = NonNullable<ImageV05["ome"]["omero"]>;
export type OmeroChannel = OmeroMetadata["channels"][number];

export async function loadOmeroChannels(url: string): Promise<OmeroChannel[]> {
  const store = new zarr.FetchStore(url);
  const group = await zarr.open(store, { kind: "group" });
  const image = parseOmeNgffImage(group);
  return image.metadata.ome.omero?.channels ?? [];
}

export async function loadOmeroDefaultZ(url: string): Promise<number> {
  const store = new zarr.FetchStore(url);
  const group = await zarr.open(store, { kind: "group" });
  // @ts-expect-error rdefs is not in the provided schema
  return group.attrs?.omero?.rdefs?.defaultZ ?? 0;
}

function conformToV05(attrs: Record<string, unknown>): ImageV05 {
  if (attrs.ome) {
    return attrs as ImageV05;
  }

  const v04Attrs = attrs as ImageV04;

  return {
    ome: {
      multiscales: v04Attrs.multiscales,
      omero: v04Attrs.omero,
      version: "0.5",
    },
  };
}

type ConformedImage = {
  metadata: ImageV05;
  originalVersion: "0.4" | "0.5";
};

export function parseOmeNgffImage(
  group: zarr.Group<zarr.FetchStore>
): ConformedImage {
  // copy attrs to avoid mutating the original
  const attrs = { ...group.attrs };

  const v05Attrs = conformToV05(attrs);

  // TODO: silly fix for removing top-level identity transform,
  // which is not allowed by spec but may have been written by
  // some writers.
  // This may need to be done for top-level `coordinateTransformations` as well.
  // https://github.com/ome/ngff/pull/152
  if (
    Array.isArray(v05Attrs.ome.multiscales) &&
    Array.isArray(v05Attrs.ome.multiscales[0]?.coordinateTransformations) &&
    v05Attrs.ome.multiscales[0].coordinateTransformations[0]?.type ===
      "identity"
  ) {
    delete v05Attrs.ome.multiscales[0].coordinateTransformations;
  }

  return {
    metadata: ImageV05.parse(v05Attrs),
    originalVersion: attrs === v05Attrs ? "0.5" : "0.4",
  };
}
