"use client";

import { useEffect, useRef } from "react";
import { Idetik, OrthographicCamera } from "@idetik/core";
import cns from "classnames";
import { useIdetik } from "hooks";

// From OME-NGFF v0.4 specification:
// https://ngff.openmicroscopy.org/0.4/#axes-md
const unitAbbreviations: Map<string, string> = new Map([
  ["angstrom", "Å"],
  ["attometer", "am"],
  ["centimeter", "cm"],
  ["decimeter", "dm"],
  ["exameter", "Em"],
  ["femtometer", "fm"],
  ["foot", "ft"],
  ["gigameter", "Gm"],
  ["hectometer", "hm"],
  ["inch", "in"],
  ["kilometer", "km"],
  ["megameter", "Mm"],
  ["meter", "m"],
  ["micrometer", "µm"],
  ["mile", "mi"],
  ["millimeter", "mm"],
  ["nanometer", "nm"],
  ["parsec", "pc"],
  ["petameter", "Pm"],
  ["picometer", "pm"],
  ["terameter", "Tm"],
  ["yard", "yd"],
  ["yoctometer", "ym"],
  ["yottameter", "Ym"],
  ["zeptometer", "zm"],
  ["zettameter", "Zm"],
]);

function getUnitAbbreviation(unit: string | undefined): string {
  if (unit === undefined) return "";
  return unitAbbreviations.get(unit.toLowerCase()) ?? unit;
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
    if (camera.type !== "Orthographic") {
      console.error("ScaleBar can only be used with OrthographicCamera");
      return;
    }
    const orthoCamera = camera as OrthographicCamera;

    const cameraWidthWorld =
      orthoCamera.transform.scale[0] * orthoCamera.viewportSize[0];
    const unitPerCanvasPixel = cameraWidthWorld / idetik.canvas.clientWidth;

    // The use of clientWidth assumes that containerDiv has no padding,
    // which is true in this case. If similar code is used elsewhere,
    // the lack of padding should be asserted and or enforced.
    const containerWidthWorld = containerDiv.clientWidth * unitPerCanvasPixel;

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
  unit?: string;
  align?: "start" | "center" | "end";
};

export function ScaleBar(props: ScaleBarProps) {
  const { runtime: idetik } = useIdetik();
  const containerDivRef = useRef<HTMLDivElement>(null);
  const textDivRef = useRef<HTMLDivElement>(null);
  const lineDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (idetik === null) return;
    const overlay = new ScaleBarOverlay(
      containerDivRef,
      lineDivRef,
      textDivRef,
      props.unit
    );
    idetik.overlays.push(overlay);
    return () => {
      const index = idetik.overlays.indexOf(overlay);
      if (index === -1) {
        idetik.overlays.splice(index);
      }
    };
  }, [idetik, props.unit]);

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
        "gap-sds-xs"
      )}
    >
      <div
        ref={textDivRef}
        className={cns(
          "text-white",
          "text-base",
          "[text-shadow:black_1px_1px_1px,black_-1px_-1px_1px,black_1px_-1px_1px,black_-1px_1px_1px]",
          "font-sds-code",
          `text-align-${align}`
        )}
      ></div>
      <div
        ref={lineDivRef}
        className={cns(
          "bg-white",
          "h-sds-m",
          "border-[thin]",
          "border-solid",
          "border-black"
        )}
      ></div>
    </div>
  );
}
