import * as zarr from "zarrita";
import { Image as ImageV04 } from "./0.4/image";
import { Plate as PlateV04 } from "./0.4/plate";
import { Well as WellV04 } from "./0.4/well";
import { Image } from "./0.5/image";
import { Plate } from "./0.5/plate";
import { Well } from "./0.5/well";
import { OmeZarrImageSource } from "./image_source";
import { Version as ZarrVersion, openGroup } from "../zarr/open";

const versions = ["0.4", "0.5"] as const;
const versionsSet: ReadonlySet<string> = new Set(versions);
export type Version = (typeof versions)[number];

type AdaptedOme<T> = T & {
  originalVersion: Version;
};

function maybeGetVersion(attrs: object): Version | undefined {
  if (!("ome" in attrs)) return;
  if (!(attrs.ome instanceof Object)) return;
  const ome = attrs.ome;
  if (!("version" in ome)) return;
  if (typeof ome.version !== "string") return;
  if (!versionsSet.has(ome.version)) return;
  return ome.version as Version;
}

function getVersion(attrs: object): Version {
  // From v0.5 onwards, we assume that ome.version indicates the version.
  // If it is not present or malformed, we assume it is v0.4, which is
  // the oldest format we support.
  const version = maybeGetVersion(attrs);
  if (version === undefined) return "0.4";
  return version;
}

export function omeZarrToZarrVersion(
  omeVersion: Version | undefined
): ZarrVersion | undefined {
  if (omeVersion === undefined) return undefined;
  switch (omeVersion) {
    case "0.4":
      return "v2";
    case "0.5":
      return "v3";
  }
}

function removeProperty<O, P extends keyof O>(obj: O, prop: P): Omit<O, P> {
  const objCopy = { ...obj };
  delete objCopy[prop];
  return objCopy;
}

export async function loadOmeZarrPlate(
  url: string,
  version?: Version
): Promise<AdaptedOme<Plate["ome"]>> {
  const store = new zarr.FetchStore(url);
  const location = new zarr.Location(store);
  const zarrVersion = omeZarrToZarrVersion(version);
  const group = await openGroup(location, zarrVersion);
  try {
    return parsePlate(group.attrs);
  } catch {
    throw Error(
      `Failed to parse OME-Zarr plate:\n${JSON.stringify(group.attrs)}`
    );
  }
}

function parsePlate(attrs: Record<string, unknown>): AdaptedOme<Plate["ome"]> {
  const version = getVersion(attrs);
  switch (version) {
    case "0.5":
      return {
        ...Plate.parse(attrs).ome,
        originalVersion: "0.5",
      };
    case "0.4":
      return {
        ...adaptPlateV04ToV05(PlateV04.parse(attrs)).ome,
        originalVersion: "0.4",
      };
  }
}

function adaptPlateV04ToV05(platev04: PlateV04): Plate {
  if (platev04.plate === undefined) {
    throw new Error("Plate metadata is missing in OME-Zarr v0.4 plate");
  }
  const plate = removeProperty(platev04.plate, "version");
  return {
    ome: {
      plate,
      version: "0.5",
    },
  };
}

function adaptWellV04ToV05(wellv04: WellV04): Well {
  if (wellv04.well === undefined) {
    throw new Error("Well metadata is missing in OME-Zarr v0.4 well");
  }
  const well = removeProperty(wellv04.well, "version");
  return {
    ome: {
      well,
      version: "0.5",
    },
  };
}

function parseWell(attrs: Record<string, unknown>): AdaptedOme<Well["ome"]> {
  const version = getVersion(attrs);
  switch (version) {
    case "0.5":
      return {
        ...Well.parse(attrs).ome,
        originalVersion: "0.5",
      };
    case "0.4":
      return {
        ...adaptWellV04ToV05(WellV04.parse(attrs)).ome,
        originalVersion: "0.4",
      };
  }
}

export async function loadOmeZarrWell(
  url: string,
  path: string,
  version?: Version
): Promise<AdaptedOme<Well["ome"]>> {
  const fullUrl = url + "/" + path;
  const store = new zarr.FetchStore(fullUrl);
  const location = new zarr.Location(store);
  const zarrVersion = omeZarrToZarrVersion(version);
  const group = await openGroup(location, zarrVersion);
  try {
    return parseWell(group.attrs);
  } catch {
    throw Error(
      `Failed to parse OME-Zarr well:\n${JSON.stringify(group.attrs)}`
    );
  }
}

export type OmeroMetadata = NonNullable<Image["ome"]["omero"]>;
export type OmeroChannel = OmeroMetadata["channels"][number];

export async function loadOmeroChannels(
  source: OmeZarrImageSource
): Promise<OmeroChannel[]> {
  const zarrVersion = omeZarrToZarrVersion(source.version);
  const group = await openGroup(source.location, zarrVersion);
  const image = parseOmeZarrImage(group.attrs);
  return image.omero?.channels ?? [];
}

export async function loadOmeroDefaults(
  source: OmeZarrImageSource
): Promise<OmeroMetadata["rdefs"]> {
  const zarrVersion = omeZarrToZarrVersion(source.version);
  const group = await openGroup(source.location, zarrVersion);
  const image = parseOmeZarrImage(group.attrs);
  return image.omero?.rdefs;
}

function adaptImageV04ToV05(imagev04: ImageV04): Image {
  return {
    ome: {
      multiscales: imagev04.multiscales,
      omero: imagev04.omero,
      version: "0.5",
    },
  };
}

function parseImage(attrs: Record<string, unknown>): AdaptedOme<Image["ome"]> {
  const version = getVersion(attrs);
  switch (version) {
    case "0.5":
      return {
        ...Image.parse(attrs).ome,
        originalVersion: "0.5",
      };
    case "0.4":
      return {
        ...adaptImageV04ToV05(ImageV04.parse(attrs)).ome,
        originalVersion: "0.4",
      };
  }
}

export function parseOmeZarrImage(
  attrs: Record<string, unknown>
): AdaptedOme<Image["ome"]> {
  try {
    return parseImage(attrs);
  } catch {
    throw Error(`Failed to parse OME-Zarr image:\n${JSON.stringify(attrs)}`);
  }
}
