import { Renderer } from "./components/Renderer";
import {
  OmeZarrImageViewerProps,
  useOmeZarrViewer,
} from "../../hooks/useOmeZarrImageViewer";
import { Button, InputSlider, LoadingIndicator } from "@czi-sds/components";
import cns from "classnames";
import { MODIFIED_SLIDER_STYLES } from "./components/ChannelControlsList/components/ChannelControl/components/ContrastSlider/styles";
import { ScaleBar } from "./components/ScaleBar/ScaleBar";

export function OmeZarrImageViewer(props: OmeZarrImageViewerProps) {
  const { classNames, indexIndicatorText, loadAllButtonText } = props;

  const {
    unit,
    zRange,
    zValue,
    setZValue,
    loading,
    allSlicesLoaded,
    loadAllSlicesCallback,
  } = useOmeZarrViewer(props);
  // Compute zIndex for display
  const zIndex = Math.round(zValue * (zRange[1] - zRange[0]) + zRange[0]);
  return (
    <div className={cns("w-full", "h-full", "relative", classNames?.root)}>
      <Renderer />
      <div
        className={cns(
          "absolute",
          "bottom-0",
          "w-full",
          "flex",
          "flex-row",
          "items-end",
          "justify-between",
          "gap-sds-l"
        )}
      >
        <div
          className={cns(
            "flex",
            "flex-col",
            "m-sds-l",
            "p-sds-xs",
            "bg-black/75",
            "backdrop-blur-md",
            "rounded-sds-m",
            "shadow-sds-m",
            "w-1/5",
            "select-none",
            props.classNames?.scaleBar
          )}
        >
          <ScaleBar unit={unit} />
        </div>
        <div
          className={cns(
            "flex",
            "flex-col",
            "flex-grow",
            "items-end",
            "m-sds-l",
            "gap-sds-xl",
            classNames?.sliceMetadataContainer
          )}
        >
          {!loading ? (
            <div
              // These share styles with ChannelControlsList
              className={cns(
                "text-white",
                "text-sm",
                "bg-black/75",
                "backdrop-blur-md",
                "p-sds-xs",
                "rounded-sds-m",
                "shadow-sds-m",
                "font-sds-code",
                "select-none",
                classNames?.sliceIndicator
              )}
            >
              {typeof indexIndicatorText === "string" && indexIndicatorText}
              {typeof indexIndicatorText === "function" &&
                indexIndicatorText(zIndex, zRange[1] - zRange[0])}
              {typeof indexIndicatorText === "undefined" &&
                `Slice ${zIndex}/${zRange[1] - zRange[0]}`}
            </div>
          ) : (
            <LoadingIndicator sdsStyle="tag" />
          )}
          {!allSlicesLoaded ? (
            <Button
              sdsType="primary"
              sdsStyle="square"
              size="small"
              disabled={loading}
              onClick={loadAllSlicesCallback}
              className={cns("shadow-sds-m", classNames?.load3dButton)}
            >
              {typeof loadAllButtonText === "string" && loadAllButtonText}
              {typeof loadAllButtonText === "function" && loadAllButtonText()}
              {typeof loadAllButtonText === "undefined" && "Load 3D high-res"}
            </Button>
          ) : (
            <div
              className={cns(
                "w-full",
                "flex",
                "bg-black/75",
                "backdrop-blur-md",
                "rounded-sds-m",
                "shadow-sds-m",
                "py-sds-xs",
                "px-sds-m",
                classNames?.sliceSliderContainer
              )}
            >
              <InputSlider
                min={0}
                max={1}
                step={1 / (zRange[1] - zRange[0])}
                value={zValue}
                {...MODIFIED_SLIDER_STYLES}
                onChange={(_, val: number | number[]) => {
                  if (typeof val === "number") setZValue(val);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
