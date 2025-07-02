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

// Converts the given number to the greatest value of the form x = y 10^z
// that is less than or equal to the given number, where y is a positive integer
// and z is an integer.
function scientificFloor(x: number): {
  value: number;
  coefficient: number;
  exponent: number;
} {
  const z = Math.floor(Math.log10(Math.abs(x)));
  const base = Math.pow(10, z);
  const y = Math.floor(x / base);
  return {
    value: y * base,
    coefficient: y,
    exponent: z,
  };
}

class ScaleBarOverlay {
  private readonly containerDivRef_: React.RefObject<HTMLDivElement>;
  private readonly lineDivRef_: React.RefObject<HTMLDivElement>;
  private readonly textDivRef_: React.RefObject<HTMLDivElement>;
  private readonly unit_: string;
  private containerWidthWorld_?: number;

  constructor(
    containerDivRef: React.RefObject<HTMLDivElement>,
    lineDivRef: React.RefObject<HTMLDivElement>,
    textDivRef: React.RefObject<HTMLDivElement>,
    unit?: string
  ) {
    this.containerDivRef_ = containerDivRef;
    this.lineDivRef_ = lineDivRef;
    this.textDivRef_ = textDivRef;
    this.unit_ = getUnitAbbreviation(unit);
  }

  update(idetik: Idetik, _timestamp: DOMHighResTimeStamp) {
    const containerDiv = this.containerDivRef_.current;
    if (containerDiv === null) return;
    const lineDiv = this.lineDivRef_.current;
    if (lineDiv === null) return;
    const textDiv = this.textDivRef_.current;
    if (textDiv === null) return;

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
    const containerWidth = containerDiv.clientWidth * window.devicePixelRatio;
    const containerWidthWorld = containerWidth * unitPerCanvasPixel;

    if (containerWidthWorld !== this.containerWidthWorld_) {
      this.containerWidthWorld_ = containerWidthWorld;
      const lineWidthWorld = scientificFloor(containerWidthWorld);
      const lineProportion = lineWidthWorld.value / containerWidthWorld;
      lineDiv.style.width = `${lineProportion * 100}%`;
      const numDecimalPlaces = Math.max(0, -lineWidthWorld.exponent);
      textDiv.textContent = `${lineWidthWorld.value.toFixed(numDecimalPlaces)} ${this.unit_}`;
    }
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
  const containerDivRef = useRef<HTMLDivElement>(null);
  const textDivRef = useRef<HTMLDivElement>(null);
  const lineDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const idetik = props.idetik;
    if (!idetik) return;
    const overlay = new ScaleBarOverlay(
      containerDivRef,
      lineDivRef,
      textDivRef,
      props.unit
    );
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
      ref={containerDivRef}
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
