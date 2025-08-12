import { OmeZarrChunkSource, VirtualCamera2D } from "@";

const url =
  "https://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/ZSNS001.ome.zarr";

const source = await OmeZarrChunkSource.fromUrl(url);
console.log("Source dimensions:", source.dimensions);
const camera: VirtualCamera2D = {
  lod: 2,
  x: { start: 150, end: 950 },
  y: { start: 100, end: 900 },
  z: 300,
  c: 0,
  t: 400,
};

const metaChunk = await source.loadMetaChunk(camera);
console.log("Loaded chunk:", metaChunk);

const allChunks = await source.initAllChunks();
console.log("Initialized all chunks:", allChunks);

const chunk = allChunks[0];
await source.loadChunkData(chunk, camera);
console.log("Loaded chunk:", chunk);
