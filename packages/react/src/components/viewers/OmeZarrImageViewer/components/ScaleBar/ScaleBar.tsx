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
  const textDivRef = useRef<HTMLDivElement>(null);
  const barDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!idetik) return;
    idetik.setScaleBar({
      textDiv: textDivRef.current!,
      barDiv: barDivRef.current!,
      unit: getUnitAbbreviation(props.unit),
    });
    return () => idetik.setScaleBar(undefined);
  }, [idetik, props.unit]);

  return (
    <div
      className={cns(
        "flex",
        "flex-col",
        "justify-center",
        "items-center",
        "m-sds-l",
        "gap-sds-xs",
        "p-sds-xs",
        "select-none",
        "bg-black/75",
        "backdrop-blur-md",
        "rounded-sds-m",
        "shadow-sds-m",
        "w-1/4",
        "bgcolor-transparent"
      )}
    >
      <div
        ref={textDivRef}
        className={cns("text-white", "text-sm", "text-align-center")}
      ></div>
      <div
        ref={barDivRef}
        className={cns("bg-white", "h-sds-m", "w-full")}
      ></div>
    </div>
  );
}
