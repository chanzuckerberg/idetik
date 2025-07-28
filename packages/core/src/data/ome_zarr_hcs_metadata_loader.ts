import * as zarr from "zarrita";
import { Plate } from "../data/ome_ngff/0.5/plate";
import { Plate as PlateV04 } from "../data/ome_ngff/0.4/plate";
import { Well } from "../data/ome_ngff/0.5/well";
import { Well as WellV04 } from "../data/ome_ngff/0.4/well";
import { Image } from "../data/ome_ngff/0.5/image";
import { Image as ImageV04 } from "../data/ome_ngff/0.4/image";

export async function loadOmeZarrPlate(url: string): Promise<Plate["ome"]["plate"]> {
  const store = new zarr.FetchStore(url);
  const group = await zarr.open(store, { kind: "group" });
  const attrs = conformPlate(group.attrs);
  // Will throw validation exceptions that we can catch if we want.
  return Plate.parse(attrs).ome.plate;
}

export async function loadOmeZarrWell(
  url: string,
  path: string
): Promise<Well["ome"]["well"]> {
  const store = new zarr.FetchStore(url + "/" + path);
  const root = await zarr.open(store, { kind: "group" });
  const attrs = conformWell(root.attrs);
  // Will throw validation exceptions that we can catch if we want.
  return Well.parse(attrs).ome.well;
}

export type OmeroMetadata = NonNullable<Image["ome"]["omero"]>;
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

function conformWell(attrs: Record<string, unknown>): Well {
  if (attrs.ome) {
    return attrs as Well;
  }
  const v04Attrs = structuredClone(attrs as WellV04);
  delete v04Attrs.well?.version;
  return {
    ome: {
      well: v04Attrs.well as Well["ome"]["well"],
      version: "0.5",
    },
  };
}

function conformPlate(attrs: Record<string, unknown>): Plate {
  if (attrs.ome) {
    return attrs as Plate;
  }
  const v04Attrs = attrs as PlateV04;
  delete v04Attrs.plate?.version;
  return {
    ome: {
      plate: v04Attrs.plate as Plate["ome"]["plate"],
      version: "0.5",
    },
  };
}

function conformImage(attrs: Record<string, unknown>): Image {
  if (attrs.ome) {
    return attrs as Image;
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
  metadata: Image;
  originalVersion: "0.4" | "0.5";
};

export function parseOmeNgffImage(
  group: zarr.Group<zarr.FetchStore>
): ConformedImage {
  const v05Attrs = conformImage(group.attrs);
  return {
    metadata: Image.parse(v05Attrs),
    originalVersion: group.attrs === v05Attrs ? "0.5" : "0.4",
  };
}
