import { Region } from "@idetik/core";
import { OmeZarrImageViewer } from "../../src/components/viewers/OmeZarrImageViewer";
import { useState } from "react";

const sourceUrl =
  "https://public.czbiohub.org/organelle_box/datasets/A549/organelle_box_crop_3fov_v2.zarr";
const wellPath = "G3BP1/Mock";
const timeDimension = "T";
const region: Region = [
  { dimension: timeDimension, index: { type: "full" } },
  { dimension: "C", index: { type: "full" } },
  { dimension: "Z", index: { type: "point", value: 0 } },
  { dimension: "Y", index: { type: "full" } },
  { dimension: "X", index: { type: "full" } },
];

const imagePaths = ["000000", "000001", "001001"];

const wellMetadataName = "time_metadata.json";
const wellMetadataUrl = `${sourceUrl}/${wellPath}/${wellMetadataName}`;

type TimeMetadata = {
  origin: string;
  start: number;
  step: number;
  unit: string;
};

async function loadTimeMetadata(): Promise<TimeMetadata> {
  const response = await fetch(wellMetadataUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch well metadata from ${wellMetadataUrl}: ${response.status} ${response.statusText}`
    );
  }
  const wellMetadata = await response.json();

  if (!("time_metadata" in wellMetadata)) {
    throw new Error(`No time metadata found in ${wellMetadataUrl}`);
  }
  const timeMetadata = wellMetadata["time_metadata"];

  if (!("origin" in timeMetadata)) {
    throw new Error(`No time origin found in ${JSON.stringify(timeMetadata)}`);
  }
  const origin = timeMetadata["origin"];
  if (typeof origin !== "string") {
    throw new Error(`Invalid time origin ${origin}`);
  }
  if (origin !== "infection") {
    throw new Error(`Unsupported time origin ${origin}`);
  }

  if (!("unit" in timeMetadata)) {
    throw new Error(`No time unit found in ${JSON.stringify(timeMetadata)}`);
  }
  const unit = timeMetadata["unit"];
  if (typeof unit !== "string") {
    throw new Error(`Invalid time unit ${unit}`);
  }
  if (unit !== "minute") {
    throw new Error(`Unsupported time unit ${unit}`);
  }

  if (!("start_time" in timeMetadata)) {
    throw new Error(`No start time found in ${JSON.stringify(timeMetadata)}`);
  }
  const start = timeMetadata["start_time"];
  if (typeof start !== "number") {
    throw new Error(`Invalid start time ${start}`);
  }

  if (!("time-gap" in timeMetadata)) {
    throw new Error(`No time gap found in ${JSON.stringify(timeMetadata)}`);
  }
  const step = timeMetadata["time-gap"];
  if (typeof step !== "number") {
    throw new Error(`Invalid time gap ${step}`);
  }

  return {
    origin,
    start,
    step,
    unit,
  };
}

function timeIndicatorText(
  currentIndex: number,
  totalIndexes: number,
  timeMetadata: TimeMetadata | null
): string {
  if (timeMetadata === null) {
    return `${currentIndex} / ${totalIndexes} frames`;
  }
  const currentTime = timeMetadata.start + currentIndex * timeMetadata.step;
  const totalTime = timeMetadata.start + totalIndexes * timeMetadata.step;
  return `${(currentTime / 60).toFixed(1)} / ${(totalTime / 60).toFixed(1)} HPI`;
}

/** Organelle Box time use case demo. */
export default function App() {
  const [imageIndex, setImageIndex] = useState(0);

  const imagePath = imagePaths[imageIndex];
  const imageUrl = `${sourceUrl}/${wellPath}/${imagePath}`;

  const [timeMetadata, setTimeMetadata] = useState<TimeMetadata | null>(null);
  if (timeMetadata === null) {
    loadTimeMetadata()
      .then((tm) => setTimeMetadata(tm))
      .catch((error) => {
        console.error("Failed to load time metadata:", error);
      });
  }

  return (
    <div className="h-screen flex flex-col">
      <OmeZarrImageViewer
        sourceUrl={imageUrl}
        region={region}
        seriesDimensionName={timeDimension}
        initialIndex="omeroDefault"
        loadAllButtonText="Load entire duration (105MB)"
        classNames={{
          root: "bg-dark-sds-color-primitive-gray-100 flex-auto min-h-0",
        }}
        indexIndicatorText={(currentIndex, totalIndexes) =>
          timeIndicatorText(currentIndex, totalIndexes, timeMetadata)
        }
      />
      <input
        type="button"
        value="Next Image"
        onClick={() => setImageIndex((imageIndex + 1) % imagePaths.length)}
        className="h-12 shrink-0 basis-[50px]"
      />
    </div>
  );
}
