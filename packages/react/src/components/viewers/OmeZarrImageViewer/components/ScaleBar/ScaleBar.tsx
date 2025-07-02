import { useEffect, useRef, useState } from "react";
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

  update(idetik: Idetik, _timestamp: DOMHighResTimeStamp) {
    const barDiv = this.barDivRef_.current;
    if (barDiv === null) return;
    const camera = idetik.camera;
    if (camera.type !== "OrthographicCamera") {
      throw new Error("ScaleBar can only be used with OrthographicCamera");
    }
    const orthoCamera = camera as OrthographicCamera;

    const cameraWidthWorld =
      orthoCamera.transform.scale[0] * orthoCamera.viewportSize[0];
    const unitPerCanvasPixel = cameraWidthWorld / idetik.width;

    // The use of clientWidth assumes that the barDiv has no padding,
    // which is true in this example. If similar code is used elsewhere,
    // the lack of padding should be asserted and or enforced.
    const barWidth = barDiv.clientWidth * window.devicePixelRatio;
    const barWidthWorld = barWidth * unitPerCanvasPixel;

    this.setBarWidth_(barWidthWorld);
  }
}

type ScaleBarProps = {
  idetik: Idetik | null;
  unit?: string;
};

export function ScaleBar(props: ScaleBarProps) {
  const barDivRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState<number>(0);

  useEffect(() => {
    const idetik = props.idetik;
    if (idetik === null) return;
    const overlay = new ScaleBarOverlay(barDivRef, setBarWidth);
    idetik.overlays.push(overlay);
    return () => {
      const index = idetik.overlays.indexOf(overlay);
      idetik.overlays.splice(index);
    };
  }, [props.idetik, setBarWidth]);

  return (
    <div
      className={cns(
        "flex",
        "flex-col",
        "shrink",
        "w-1/4",
        "m-sds-l",
        "gap-sds-xs",
        "p-sds-xs",
        "justify-center",
        "items-center",
        "bg-black/75",
        "backdrop-blur-md",
        "rounded-sds-m",
        "shadow-sds-m",
        "text-white",
        "text-base",
        "text-align-center",
        "select-none"
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
