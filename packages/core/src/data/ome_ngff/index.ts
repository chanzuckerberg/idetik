import * as zarr from "zarrita";
import { Image as ImageV04 } from "./0.4/image";
// import { Plate as PlateV04 } from "./0.4/plate";
// import { Well as WellV04 } from "./0.4/well";
import { Image } from "./0.5/image";
import { Plate } from "./0.5/plate";
import { Well } from "./0.5/well";

const versions = ["0.4", "0.5"] as const;
const versionsSet: ReadonlySet<string> = new Set(versions);
type Version = (typeof versions)[number];

function getVersion(attrs: object): Version {
  // From v0.5 onwards, we assume that ome.version indicates the version.
  // If it is not present or malformed, we assume it is v0.4, which is
  // the oldest format we support.
  const fallback = "0.4"
  if (!("ome" in attrs)) return fallback;
  if (!(attrs.ome instanceof Object)) return fallback;
  const ome = attrs.ome;
  if (!("version" in ome)) return fallback;
  if (typeof ome.version !== "string") return fallback;
  if (!versionsSet.has(ome.version)) return fallback;
  return ome.version as Version;
}

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

export type OmeroMetadata = NonNullable<Image["ome"]["omero"]>;
export type OmeroChannel = OmeroMetadata["channels"][number];

export async function loadOmeroChannels(url: string): Promise<OmeroChannel[]> {
  const store = new zarr.FetchStore(url);
  const group = await zarr.open(store, { kind: "group" });
  const image = parseOmeNgffImage(group);
  return image.image.ome.omero?.channels ?? [];
}

export async function loadOmeroDefaultZ(url: string): Promise<number> {
  const store = new zarr.FetchStore(url);
  const group = await zarr.open(store, { kind: "group" });
  // @ts-expect-error rdefs is not in the provided schema
  return group.attrs?.omero?.rdefs?.defaultZ ?? 0;
}

function adaptImageV04(imagev04: ImageV04): Image {
  return {
    ome: {
      multiscales: imagev04.multiscales,
      omero: imagev04.omero,
      version: "0.5",
    },
  };
}

type NormalizedImage = {
  image: Image;
  originalVersion: Version;
};

export function parseOmeNgffImage(image: object): NormalizedImage {
  const version = getVersion(image);
  switch (version) {
    case "0.5":
      return {
        image: Image.parse(image),
        originalVersion: "0.5",
      };
    case "0.4":
      return {
        image: adaptImageV04(ImageV04.parse(image)),
        originalVersion: "0.4",
      }
  }
}
