const PLATE_URL = "http://localhost:8000";
export const DEFAULT_IMAGE_URL = `${PLATE_URL}/GOLGA2/Live/000000`;

export const DEFAULT_REGION = [
    { dimension: "T", index: 0 },
    { dimension: "Z", index: 0 },
] as const;

export type Region = typeof DEFAULT_REGION;