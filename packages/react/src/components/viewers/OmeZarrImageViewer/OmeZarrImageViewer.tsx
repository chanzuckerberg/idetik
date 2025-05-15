import { Renderer } from "./components/Renderer";
import { useOmeZarrViewer } from "./useOmeZarrImageViewer";
import { Region } from "@idetik/core";
import { Button, InputSlider, LoadingIndicator } from "@czi-sds/components";
import cns from "classnames";
import { MODIFIED_SLIDER_STYLES } from "./components/ChannelControlsList/components/ChannelControl/components/ContrastSlider/styles";

interface OmeZarrViewerContainerProps {
  sourceUrl: string;
  region: Region;
  seriesDimensionName: string;
  allSlicesSizeEstimate?: string;
  fallbackContrastLimits?: [number, number];
  classNames?: {
    root?: string;
    sliceMetadataContainer?: string;
    sliceIndicator?: string;
    load3dButton?: string;
    sliceSliderContainer?: string;
  };
  onLayerCreated?: () => void;
  onFirstSliceLoaded?: () => void;
  onLoadAllSlicesClicked?: () => void;
  onAllSlicesLoaded?: () => void;
  onLoadAllSlicesAborted?: () => void;
}

export function OmeZarrImageViewer(props: OmeZarrViewerContainerProps) {
  const {
    sourceUrl,
    region,
    seriesDimensionName,
    allSlicesSizeEstimate,
    fallbackContrastLimits,
    classNames,
    onLayerCreated,
    onFirstSliceLoaded,
    onLoadAllSlicesClicked,
    onAllSlicesLoaded,
    onLoadAllSlicesAborted,
  } = props;

  const {
    layerManager,
    camera,
    zRange,
    zValue,
    zIndex,
    setZValue,
    loading,
    allSlicesLoaded,
    loadAllSlicesCallback,
  } = useOmeZarrViewer({
    sourceUrl,
    region,
    seriesDimensionName,
    fallbackContrastLimits,
    onLayerCreated,
    onFirstSliceLoaded,
    onLoadAllSlicesClicked,
    onAllSlicesLoaded,
    onLoadAllSlicesAborted,
  });

  return (
    <div className={cns("w-full", "h-full", "relative", classNames?.root)}>
      <Renderer
        layerManager={layerManager}
        camera={camera}
        cameraControls="panzoom"
      />
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
            Slice {zIndex.toString().padStart(2, "0")}/{zRange[1] - zRange[0]}
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
