import cns from "classnames";
import { InputSlider } from "@czi-sds/components";

interface ZControlProps {
  onChange: (zIndex: number) => void;
  disabled: boolean;
}

export function ZControl({ onChange, disabled }: ZControlProps) {
  return (
    <div
      className={cns(
        "before:absolute",
        "before:left-0",
        "before:top-0",
        "before:w-full",
        "before:h-full",
        "before:bg-[--sds-color-semantic-base-background-primary]",
        "before:opacity-50",
        "before:content-['']",
        "flex",
        "items-center"
      )}
    >
      <InputSlider
        min={0}
        max={1}
        step={0.01}
        defaultValue={0.5}
        onChange={(_, value: number | number[]) => {
          if (typeof value === "number") {
            onChange(value);
          } else {
            throw new Error(`Expected a single value, got ${value}`);
          }
        }}
        disabled={disabled}
      />
    </div>
  );
}
