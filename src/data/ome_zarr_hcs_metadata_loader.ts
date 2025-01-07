type Acquisition = {
    id: number;
    maximumfieldcount: number;
    name: string;
    starttime: number;
};

type Column = {
    name: string;
};

type Row = {
    name: string;
};

type Well = {
    path: string;
    rowIndex: number;
    columnIndex: number;
};

type Plate = {
    version: string;
    name: string;
    field_count: number;
    acquisitions: Acquisition[];
    columns: Column[];
    rows: Row[];
    wells: Well[];
};

export type PlateMetadata = {
    plate: Plate;
};

export type WellMetadata = {

};
