import { Region } from "@idetik/core";
import { IdetikLayerList } from "./IdetikLayerList";
import { HcsImagePanel } from "./HcsImagePanel";
import { OmeZarrImageViewer } from "./viewers/OmeZarrImageViewer/OmeZarrImageViewer";
import { useState } from "react";

interface AppProps {
  baseUrl?: string;
}

/** Demonstration app for Idetik with HCS image support */
export default function App({
  baseUrl = "https://public.czbiohub.org/organelle_box/datasets/A549/organelle_box_crop_v1.zarr",
}: AppProps) {
  const [well, setWell] = useState<string>("ACTB/PFA");
  const [fov, setFov] = useState<string>("001002");

  const sourceUrl = `${baseUrl}/${well}/${fov}`;
  const region: Region = [
    { dimension: "T", index: { type: "point", value: 0 } },
    { dimension: "C", index: { type: "full" } },
    { dimension: "Z", index: { type: "full" } },
    { dimension: "Y", index: { type: "full" } },
    { dimension: "X", index: { type: "full" } },
  ];

  return (
    <div className="h-screen flex">
      <div className="flex-1 relative">
        <OmeZarrImageViewer
          sourceUrl={sourceUrl}
          region={region}
          seriesDimensionName="Z"
          loadAllButtonText={"Load 3D high-res (250MB)"}
          classNames={{
            sliceMetadataContainer:
              "absolute bottom-0 right-0 w-full p-sds-l flex flex-col items-end gap-sds-l",
          }}
        />
      </div>

      <div className="w-64 p-4 bg-gray-100 flex flex-col gap-4">
        <HcsImagePanel
          baseUrl={baseUrl}
          well={well}
          fov={fov}
          onWellChange={setWell}
          onFovChange={setFov}
        />
        <IdetikLayerList />
      </div>
    </div>
  );
}
