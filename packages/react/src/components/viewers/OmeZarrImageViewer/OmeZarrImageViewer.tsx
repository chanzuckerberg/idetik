import { Renderer } from "./components/Renderer";
import {
  OmeZarrImageViewerProps,
  useOmeZarrViewer,
} from "../../hooks/useOmeZarrImageViewer";
import { Button, InputSlider, LoadingIndicator } from "@czi-sds/components";
import cns from "classnames";
import { MODIFIED_SLIDER_STYLES } from "./components/ChannelControlsList/components/ChannelControl/components/ContrastSlider/styles";

export function OmeZarrImageViewer(props: OmeZarrImageViewerProps) {
  const {
    sourceUrl,
    region,
    seriesDimensionName,
    cameraControlType = "panzoom",
    allSlicesSizeEstimate,
    fallbackContrastLimits,
    classNames,
    onLayerCreated,
    onFirstSliceLoaded,
    onLoadAllSlicesClicked,
    onAllSlicesLoaded,
    onLoadAllSlicesAborted,
    lod,
    shouldAutoLoadAllSlices,
    shouldLoadMiddleZ,
  } = props;

  const {
    zRange,
    zValue,
    setZValue,
    loading,
    allSlicesLoaded,
    loadAllSlicesCallback,
  } = useOmeZarrViewer({
    sourceUrl,
    region,
    seriesDimensionName,
    cameraControlType,
    fallbackContrastLimits,
    onLayerCreated,
    onFirstSliceLoaded,
    onLoadAllSlicesClicked,
    onAllSlicesLoaded,
    onLoadAllSlicesAborted,
    lod,
    shouldAutoLoadAllSlices,
    shouldLoadMiddleZ,
  });
  // Compute zIndex for display
  const zIndex = Math.round(zValue * (zRange[1] - zRange[0]) + zRange[0]);
  return (
    <div className={cns("w-full", "h-full", "relative", classNames?.root)}>
      <Renderer />
      <div
        className={cns(
          "absolute",
          "bottom-0",
          "right-0",
          "w-full",
          "p-sds-l",
          "flex",
          "flex-col",
          "items-end",
          "gap-sds-l",
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
              "p-sds-xs",
              "rounded-sds-m",
              "shadow-sds-m",
              "font-sds-code",
              classNames?.sliceIndicator
            )}
          >
            Slice {zIndex}/{zRange[1] - zRange[0]}
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
            {allSlicesSizeEstimate
              ? `Load 3D high-res (${allSlicesSizeEstimate})`
              : "Load 3D high-res"}
          </Button>
        ) : (
          <div
            className={cns(
              "w-full md:w-[200px]",
              "flex",
              "bg-black/75",
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
  );
}
