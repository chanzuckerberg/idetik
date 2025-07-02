import { useEffect, useRef } from "react";
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
  private lineDivRef_: React.RefObject<HTMLDivElement>;
  private textDivRef_: React.RefObject<HTMLDivElement>;
  private unit_: string;

  constructor(
    lineDivRef: React.RefObject<HTMLDivElement>,
    textDivRef: React.RefObject<HTMLDivElement>,
    unit?: string
  ) {
    this.lineDivRef_ = lineDivRef;
    this.textDivRef_ = textDivRef;
    this.unit_ = getUnitAbbreviation(unit);
  }

  update(idetik: Idetik, _timestamp: DOMHighResTimeStamp) {
    const lineDiv = this.lineDivRef_.current;
    if (lineDiv === null) return;
    const textDiv_ = this.textDivRef_.current;
    if (textDiv_ === null) return;
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
    const lineWidth = lineDiv.clientWidth * window.devicePixelRatio;
    const lineWidthWorld = lineWidth * unitPerCanvasPixel;

    textDiv_.textContent = `${lineWidthWorld.toFixed(2)} ${this.unit_}`;
  }
}

type ScaleBarProps = {
  idetik: Idetik | null;
  textColor?: string;
  textSize?: "text-xs" | "text-sm" | "text-base" | "text-lg" | "text-xl";
  lineColor?: string;
  lineHeight?: string;
  align?: "start" | "center" | "end";
  unit?: string;
};

export function ScaleBar(props: ScaleBarProps) {
  const textDivRef = useRef<HTMLDivElement>(null);
  const lineDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const idetik = props.idetik;
    if (!idetik) return;
    const overlay = new ScaleBarOverlay(lineDivRef, textDivRef, props.unit);
    idetik.overlays.push(overlay);
    return () => {
      const index = idetik.overlays.indexOf(overlay);
      idetik.overlays.splice(index);
    };
  }, [props.idetik, props.unit]);

  const textColor = props.textColor ?? "text-white";
  const textSize = props.textSize ?? "text-base";
  const lineColor = props.lineColor ?? "bg-white";
  const lineHeight = props.lineHeight ?? "h-sds-m";
  const align = props.align ?? "start";

  return (
    <div
      className={cns(
        "flex",
        "flex-col",
        `items-${align}`,
        "w-full",
        "h-full",
        "gap-sds-xs",
        "select-none"
      )}
    >
      <div
        ref={textDivRef}
        className={cns(textColor, textSize, `text-align-${align}`)}
      ></div>
      <div
        ref={lineDivRef}
        className={cns(lineColor, lineHeight, "w-full")}
      ></div>
    </div>
  );
}
