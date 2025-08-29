import { Region } from "@idetik/core-prerelease";
import { OmeZarrImageViewer } from "../../src/components/viewers/OmeZarrImageViewer";
import { useState } from "react";

const region: Region = [
  { dimension: "y", index: { type: "full" } },
  { dimension: "x", index: { type: "full" } },
];

/**
 * Local Zarr directory demo.
 *
 * Example file:
 * aws s3 --no-sign-request sync s3://cryoet-data-portal-public/10446/TS_101_9/Reconstructions/VoxelSpacing10.012/Tomograms/103/TS_101_9.zarr TS_101_9.zarr
 */
export default function App() {
  const [directory, setDirectory] = useState<FileSystemDirectoryHandle>();

  return (
    <div className="h-screen flex flex-col">
      <OmeZarrImageViewer
        sourceLocalDirectory={directory && { directory }}
        region={region}
        fallbackContrastLimits={[0, 1]}
        initialIndex="middle"
        loadAllButtonText="Load all"
        resolutionLevel={0}
        classNames={{
          root: "bg-dark-sds-color-primitive-gray-100 flex-auto min-h-0",
        }}
      />
      <input
        type="button"
        value="Select local folder"
        onClick={async () => {
          // @ts-expect-error -- Method not in types
          setDirectory(await window.showDirectoryPicker());
        }}
        className="h-12 shrink-0 basis-[50px]"
      />
    </div>
  );
}
