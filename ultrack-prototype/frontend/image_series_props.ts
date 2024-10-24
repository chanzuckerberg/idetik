// Source is 5D, so provide an interval in T and Z (first of only depth) to get
// a multi-channel 2D image series.
export const imageSeriesTimeInterval = { start: 100, stop: 120 };
export const imageSeriesProps = {
  url: "https://public.czbiohub.org/royerlab/ultrack/multi-color/image.zarr/",
  region: [
    { dimension: "T", index: imageSeriesTimeInterval },
    { dimension: "Z", index: 0 },
  ],
  timeDimension: "T",
};
