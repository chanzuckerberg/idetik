import * as zarr from "zarrita";
import { Image as ImageV04 } from "./0.4/image";
import { Plate as PlateV04 } from "./0.4/plate";
import { Well as WellV04 } from "./0.4/well";
import { Image } from "./0.5/image";
import { Plate } from "./0.5/plate";
import { Well } from "./0.5/well";
import { OmeZarrImageSource } from "./ome_zarr_image_source";
import { openGroup } from "../zarrita/open";

const versions = ["0.4", "0.5"] as const;
const versionsSet: ReadonlySet<string> = new Set(versions);
type Version = (typeof versions)[number];

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

function removeProperty<O, P extends keyof O>(obj: O, prop: P): Omit<O, P> {
  const objCopy = { ...obj };
  delete objCopy[prop];
  return obj;
}

export async function loadOmeZarrPlate(
  url: string
): Promise<AdaptedOme<Plate["ome"]["plate"]>> {
  const location = new zarr.Location(new zarr.FetchStore(url));
  const group = await openGroup(location);
  try {
    return parsePlate(group.attrs);
  } catch {
    throw Error(
      `Failed to parse OME-Zarr plate:\n${JSON.stringify(group.attrs)}`
    );
  }
}

function parsePlate(
  attrs: Record<string, unknown>
): AdaptedOme<Plate["ome"]["plate"]> {
  const version = getVersion(attrs);
  switch (version) {
    case "0.5":
      return {
        ...Plate.parse(attrs).ome.plate,
        originalVersion: "0.5",
      };
    case "0.4":
      return {
        ...adaptPlateV04ToV05(PlateV04.parse(attrs)).ome.plate,
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

function parseWell(
  attrs: Record<string, unknown>
): AdaptedOme<Well["ome"]["well"]> {
  const version = getVersion(attrs);
  switch (version) {
    case "0.5":
      return {
        ...Well.parse(attrs).ome.well,
        originalVersion: "0.5",
      };
    case "0.4":
      return {
        ...adaptWellV04ToV05(WellV04.parse(attrs)).ome.well,
        originalVersion: "0.4",
      };
  }
}

export async function loadOmeZarrWell(
  url: string,
  path: string
): Promise<AdaptedOme<Well["ome"]["well"]>> {
  const location = new zarr.Location(new zarr.FetchStore(url + "/" + path));
  const group = await openGroup(location);
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
  const group = await openGroup(source.location);
  const image = parseOmeNgffImage(group.attrs);
  return image.omero?.channels ?? [];
}

export async function loadOmeroDefaultZ(
  source: OmeZarrImageSource
): Promise<number> {
  const group = await openGroup(source.location);
  // @ts-expect-error rdefs is not in the provided schema
  return group.attrs?.omero?.rdefs?.defaultZ ?? 0;
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

export function parseOmeNgffImage(
  attrs: Record<string, unknown>
): AdaptedOme<Image["ome"]> {
  try {
    return parseImage(attrs);
  } catch {
    throw Error(`Failed to parse OME-Zarr image:\n${JSON.stringify(attrs)}`);
  }
}
