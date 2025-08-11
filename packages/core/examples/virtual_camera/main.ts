import {
    OmeZarrChunkSource,
    VirtualCamera2D,
} from "@";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr";

// TODO: automatically infer dimensions when not given.
const dimensions = {
    x: { name: "x" },
    y: { name: "y" },
    z: { name: "z" },
    c: { name: "c" },
    t: { name: "t" },
};
const source = await OmeZarrChunkSource.fromUrl(url, dimensions);
console.log("Source dimensions:", source.dimensions);
const camera: VirtualCamera2D = {
    lod: 2,
    x: {start: 150, end: 950},
    y: {start: 100, end: 900},
    z: 300,
    c: 0,
    t: 400,
};

const chunk = await source.loadChunk(camera);
console.log("Loaded chunk:", chunk);

const chunks = await source.loadChunks(camera);
console.log("Loaded chunks:", chunks);
