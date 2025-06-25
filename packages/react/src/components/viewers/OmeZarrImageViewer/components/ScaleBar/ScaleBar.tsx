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
  private barDiv_: HTMLDivElement;
  private readonly onBarWidthChanged_: (width: number) => void;

  public constructor(
    barDiv: HTMLDivElement,
    onBarWidthChanged: (width: number) => void
  ) {
    this.barDiv_ = barDiv;
    this.onBarWidthChanged_ = onBarWidthChanged;
  }

  public update(idetik: Idetik) {
    const camera = idetik.camera;
    if (camera.type !== "OrthographicCamera") {
      throw new Error("ScaleBar can only be used with OrthographicCamera");
    }
    const orthoCamera = camera as OrthographicCamera;
    const cameraWidth =
      orthoCamera.transform.scale[0] * orthoCamera.viewportSize[0];
    const barWidth = (this.barDiv_.offsetWidth / idetik.width) * cameraWidth;
    this.onBarWidthChanged_(barWidth);
  }
}

type ScaleBarProps = {
  unit?: string;
};

export function ScaleBar(props: ScaleBarProps) {
  const { idetik } = useIdetik();
  const barDivRef = useRef(null);
  const [barWidth, setBarWidth] = useState<number>(0);

  useEffect(() => {
    if (!idetik || !barDivRef.current) return;
    const scaleBar = new ScaleBarOverlay(barDivRef.current!, setBarWidth);
    idetik.overlays.push({ update: scaleBar.update });
    return () => {
      const idx = idetik.overlays.indexOf(scaleBar);
      if (idx > -1) idetik.overlays.splice(idx, 1);
    };
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
        "px-0",
        "py-sds-xs",
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
