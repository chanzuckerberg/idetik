import * as zarr from "zarrita";
import { Image as ImageV04 } from "./0.4/image";
// import { Plate as PlateV04 } from "./0.4/plate";
// import { Well as WellV04 } from "./0.4/well";
import { Image } from "./0.5/image";
import { Plate } from "./0.5/plate";
import { Well } from "./0.5/well";

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

const versions = ["0.4", "0.5"] as const;
type Version = (typeof versions)[number];

type attrsWithVersion = {
  version: Version;
};

function hasVersion(ome: object): ome is attrsWithVersion {
  return "version" in ome && versions.includes(ome.version as Version);
}

function getVersion(ome: object) {
  if (hasVersion(ome)) {
    return ome.version;
  }
}

function isImageV04(image: object): image is ImageV04 {
  // In v0.4, the version is buried in a multiscales array element and
  // is optional, so it's easier to just check for the multiscales array.
  return "multiscales" in image && Array.isArray(image.multiscales);
}

type imageWithOmeObject = {
  ome: object;
};

function hasOmeObject(image: object): image is imageWithOmeObject {
  return "ome" in image && typeof image.ome === "object";
}

function getOmeObject(image: object) {
  if (hasOmeObject(image)) {
    return image.ome;
  }
}

function isImageV05(image: object): image is Image {
  const ome = getOmeObject(image);
  if (ome === undefined) return false;
  return getVersion(ome) !== "0.5";
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

function normalizeImage(image: object): NormalizedImage {
  if (isImageV04(image)) {
    return {
      image: adaptImageV04(image),
      originalVersion: "0.4",
    };
  }
  if (isImageV05(image)) {
    return {
      image,
      originalVersion: "0.5",
    };
  }
  throw new Error("Unknown image version");
}

export function parseOmeNgffImage(
  group: zarr.Group<zarr.FetchStore>
): NormalizedImage {
  // copy attrs to avoid mutating the original
  const attrs = { ...group.attrs };

  const { image, originalVersion } = normalizeImage(attrs);

  // TODO: silly fix for removing top-level identity transform,
  // which is not allowed by spec but may have been written by
  // some writers.
  // This may need to be done for top-level `coordinateTransformations` as well.
  // https://github.com/ome/ngff/pull/152
  if (
    Array.isArray(image.ome.multiscales) &&
    Array.isArray(image.ome.multiscales[0]?.coordinateTransformations) &&
    image.ome.multiscales[0].coordinateTransformations[0]?.type === "identity"
  ) {
    delete image.ome.multiscales[0].coordinateTransformations;
  }

  return {
    image: Image.parse(image),
    originalVersion: originalVersion,
  };
}
