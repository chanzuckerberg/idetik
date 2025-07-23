import {
  ChannelProps,
  Color,
  Idetik,
  ImageSeriesLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  Region,
} from "@";

/**
 * Example Zarr:
 *
 * aws s3 --no-sign-request sync s3://cryoet-data-portal-public/10446/TS_101_9/Reconstructions/VoxelSpacing10.012/Tomograms/103/TS_101_9.zarr TS_101_9.zarr
 */

document.getElementById("button")!.addEventListener("click", async () => {
  // @ts-expect-error -- Method not in types
  const directory = await window.showDirectoryPicker();

  const source = new OmeZarrImageSource(directory);

  const region: Region = [
    { dimension: "z", index: { type: "full" } },
    { dimension: "y", index: { type: "full" } },
    { dimension: "x", index: { type: "full" } },
  ];
  const channelProps: ChannelProps[] = [
    {
      visible: true,
      color: Color.WHITE,
      contrastLimits: [-0.00001, 0.00001],
    },
  ];
  const layer = new ImageSeriesLayer({
    source,
    region,
    seriesDimensionName: "z",
    channelProps,
  });

  const slider = document.querySelector<HTMLInputElement>("#slider");
  if (slider === null) throw new Error("Time slider not found.");
  slider.addEventListener("input", (event) => {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    const index = value;
    layer.setIndex(index);
  });

  layer.setIndex(0);
  layer.preloadSeries();

  const camera = new OrthographicCamera(0, 6327, 0, 6327);
  new Idetik({
    canvas: document.querySelector<HTMLCanvasElement>("canvas")!,
    camera,
    layers: [layer],
  }).start();
});
