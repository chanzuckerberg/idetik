import * as zarr from "zarrita";

// Plate metadata from OME-NGFF v0.4:
// https://ngff.openmicroscopy.org/0.4/#plate-md
type PlateAcquisition = {
    // >= 0
    id: number;
    name?: string;
    description?: string;
    // > 0, maximum number of fields of view for the acquisition
    maximumfieldcount?: number;
    // integer epoch timestamps
    starttime?: number;
    endtime?: number;
};

type PlateColumn = {
    // alphanumeric characters only, case sensitive, unique across all columns in plate
    name: string;
};

type PlateRow = {
    // alphanumeric characters only, case sensitive, unique across all rows in plate
    name: string;
};

type PlateWell = {
    // must be of the form {row}/{column} where {row} is a row name and {column} is a column name
    // must not contain additional leading or trailing directories
    path: string;
    // 0-based indices into the plate's rows and columns
    rowIndex: number;
    columnIndex: number;
};

export type Plate = {
    plate: {
        columns: PlateColumn[];
        rows: PlateRow[];
        wells: PlateWell[];
        name?: string;
        version?: string;
        // > 0, number of fields per view across all wells
        field_count?: number;
        acquisitions?: PlateAcquisition[];
    };
};

// Well metadata from OME-NGFF v0.4:
// https://ngff.openmicroscopy.org/0.4/#well-md
type WellImage = {
    // alphanumeric characters only, case sensitive, unique within the well image paths
    path: string;
    // present if multiple acquisitions were performed in the plate
    // identifies the acquisition from the plate acquisition metadata
    acquisition?: number;
};

export type Well = {
    well: {
        images: WellImage[];
        version?: string;
    }
};

export async function loadOmeZarrPlate(url: string): Promise<Plate> {
    const store = new zarr.FetchStore(url);
    const group = await zarr.open.v2(store, { kind: "group" });
    // TODO: validate attributes
    return group.attrs as Plate;
}

export async function loadOmeZarrWell(url: string, path: string): Promise<Well> {
    const store = new zarr.FetchStore(url + "/" + path);
    const root = await zarr.open.v2(store, { kind: "group" });
    // TODO: validate attributes
    return root.attrs as Well;
}