import { useEffect, useRef } from "react";
import { useIdetik } from "components/hooks";
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

type ScaleBarProps = {
  textColor?: string;
  textSize?: "text-xs" | "text-sm" | "text-base" | "text-lg" | "text-xl";
  lineColor?: string;
  lineHeight?: string;
  align?: "start" | "center" | "end";
  unit?: string;
};

export function ScaleBar(props: ScaleBarProps) {
  const { idetik } = useIdetik();
  const containerDivRef = useRef<HTMLDivElement>(null);
  const textDivRef = useRef<HTMLDivElement>(null);
  const lineDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!idetik) return;
    idetik.setScaleBar({
      containerDiv: containerDivRef.current!,
      textDiv: textDivRef.current!,
      lineDiv: lineDivRef.current!,
      unit: getUnitAbbreviation(props.unit),
    });
    return () => idetik.setScaleBar(undefined);
  }, [idetik, props.unit]);

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
