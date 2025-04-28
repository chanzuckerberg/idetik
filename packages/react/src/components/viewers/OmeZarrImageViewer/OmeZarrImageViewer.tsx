import { ChannelControlsList } from "./components/ChannelControlsList";
import { Renderer } from "./components/Renderer";
import { useOmeZarrViewer } from "./useOmeZarrImageViewer";
import { Region } from "@idetik/core";
import { Button, InputSlider } from "@czi-sds/components";
import cns from "classnames";
import { MODIFIED_SLIDER_STYLES } from "./components/ChannelControlsList/components/ChannelControl/components/ContrastSlider/styles";

interface OmeZarrViewerContainerProps {
  sourceUrl: string;
  region: Region;
  seriesDimensionName: string;
  allSlicesSizeEstimate?: string;
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
    onLayerCreated,
    onFirstSliceLoaded,
    onLoadAllSlicesClicked,
    onAllSlicesLoaded,
    onLoadAllSlicesAborted,
  } = props;

  const {
    layerManager,
    camera,
    imageLayer,
    controlProps,
    zRange,
    zValue,
    zIndex,
    setZValue,
    loading,
    allSlicesLoaded,
    resetChannelsCallback,
    loadAllSlicesCallback,
  } = useOmeZarrViewer({
    sourceUrl,
    region,
    seriesDimensionName,
    onLayerCreated,
    onFirstSliceLoaded,
    onLoadAllSlicesClicked,
    onAllSlicesLoaded,
    onLoadAllSlicesAborted,
  });
  return (
    <div
      className={cns(
        "w-full",
        "h-full",
        "flex",
        "flex-col",
        "flex-1",
        "gap-4",
        "min-h-0",
        "relative"
      )}
    >
      <Renderer
        layerManager={layerManager}
        camera={camera}
        cameraControls="panzoom"
      />

      {imageLayer && (
        <div
          className={cns(
            "absolute",
            "top-0",
            "left-0",
            "w-full",
            "md:!w-[400px]" // For some reason, this gets overwritten when compiled
            // so make it important
          )}
        >
          <ChannelControlsList
            layer={imageLayer}
            controlProps={controlProps}
            resetCallback={resetChannelsCallback}
          />
        </div>
      )}

      <div
        className={cns(
          "absolute",
          "bottom-0",
          "right-0",
          "w-full",
          "m-sds-l",
          "flex",
          "flex-col",
          "items-end"
        )}
      >
        <div
          className={cns(
            "flex",
            "justify-end",
            "items-center",
            "w-full",
            "h-6"
          )}
        >
          <div className={cns("flex", "justify-end", "w-1/3")}>
            {!loading && (
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
                  "font-sds-code"
                )}
              >
                Slice {zIndex.toString().padStart(2, "0")}/
                {zRange[1] - zRange[0]}
              </div>
            )}
          </div>
        </div>
        {!allSlicesLoaded && (
          <Button
            sdsType="primary"
            sdsStyle="square"
            size="small"
            disabled={loading}
            onClick={loadAllSlicesCallback}
            className="mt-sds-l shadow-sds-m"
          >
            {allSlicesSizeEstimate
              ? `Load 3D high-res (${allSlicesSizeEstimate})`
              : "Load 3D high-res"}
          </Button>
        )}
        {allSlicesLoaded && (
          <div
            className={cns(
              // When using width 100%, the slider goes out of the
              // container, just undo it by subtracting the margin
              // of the container
              "w-[calc(100%-2*theme(spacing.sds-l))] md:w-[200px]",
              "flex",
              "justify-center",
              "items-center",
              "gap-2",
              "mt-sds-l",
              "bg-black/75",
              "backdrop-blur-md",
              "rounded-sds-m",
              "shadow-sds-m",
              "py-sds-xs",
              "px-sds-m"
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
