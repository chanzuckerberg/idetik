// Source is 5D, so provide an interval in T and scalar indices in C (first of
// three channels) and Z (first of only depth) to get a 2D image series.
export const imageSeriesTimeInterval = { start: 100, stop: 120 };
export const imageSeriesProps = {
  url: "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/",
  region: [
    { dimension: "T", index: imageSeriesTimeInterval },
    { dimension: "C", index: 0 },
    { dimension: "Z", index: 0 },
  ],
  timeDimension: "T",
};
