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

  return (
    <div
      ref={containerDivRef}
      className={cns(
        "flex",
        "flex-col",
        "items-center",
        "w-full",
        "h-full",
        "gap-sds-xs",
        "select-none"
      )}
    >
      <div
        ref={textDivRef}
        className={cns("text-white", "text-sm", "text-align-center")}
      ></div>
      <div
        ref={lineDivRef}
        className={cns("bg-white", "h-sds-m", "w-full")}
      ></div>
    </div>
  );
}
