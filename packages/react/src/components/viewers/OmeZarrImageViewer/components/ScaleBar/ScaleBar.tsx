import { useEffect, useRef, useState } from "react";
import { useIdetik } from "components/hooks";
import { Idetik, OrthographicCamera } from "@idetik/core";
import cns from "classnames";

function getUnitAbbreviation(unit: string | undefined): string {
  if (unit === undefined) return "";
  switch (unit.toLowerCase()) {
    case "nanometer":
      return "nm";
    case "micrometer":
      return "µm";
    case "millimeter":
      return "mm";
    case "centimeter":
      return "cm";
    case "meter":
      return "m";
    default:
      return unit;
  }
}

class ScaleBarOverlay {
  private barDivRef_: React.RefObject<HTMLDivElement>;
  private setBarWidth_: React.Dispatch<React.SetStateAction<number>>;

  constructor(
    barDivRef: React.RefObject<HTMLDivElement>,
    setBarWidth: React.Dispatch<React.SetStateAction<number>>
  ) {
    this.barDivRef_ = barDivRef;
    this.setBarWidth_ = setBarWidth;
  }

  update(idetik: Idetik) {
    const barDiv = this.barDivRef_.current;
    if (barDiv === null) return;
    const camera = idetik.camera;
    if (camera.type !== "OrthographicCamera") {
      throw new Error("ScaleBar can only be used with OrthographicCamera");
    }
    const orthoCamera = camera as OrthographicCamera;
    const cameraWidth =
      orthoCamera.transform.scale[0] * orthoCamera.viewportSize[0];
    const barWidth = (barDiv.offsetWidth / idetik.width) * cameraWidth;
    this.setBarWidth_(barWidth);
  }
}

type ScaleBarProps = {
  unit?: string;
};

export function ScaleBar(props: ScaleBarProps) {
  const { idetik } = useIdetik();
  const barDivRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState<number>(0);

  useEffect(() => {
    if (!idetik) return;
    const overlay = new ScaleBarOverlay(barDivRef, setBarWidth);
    idetik.overlayManager.add(overlay);
    return () => idetik.overlayManager.remove(overlay);
  }, [idetik, setBarWidth]);

  return (
    <div
      className={cns(
        "flex",
        "flex-col",
        "justify-center",
        "items-center",
        "text-white",
        "text-sm",
        "text-align-center",
        "m-sds-l",
        "gap-sds-xs",
        "p-sds-xs",
        "select-none",
        "bg-black/75",
        "backdrop-blur-md",
        "rounded-sds-m",
        "shadow-sds-m",
        "w-1/4"
      )}
    >
      {barWidth > 0 &&
        `${barWidth.toFixed(2)} ${getUnitAbbreviation(props.unit)}`}
      <div
        ref={barDivRef}
        className={cns("bg-white", "h-sds-m", "w-full")}
      ></div>
    </div>
  );
}
