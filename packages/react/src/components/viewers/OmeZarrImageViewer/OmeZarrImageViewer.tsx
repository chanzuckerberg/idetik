import { ChannelControlsList } from "./components/ChannelControlsList"; // adjust paths as needed
import { Renderer } from "./components/Renderer";
import { useOmeZarrViewer } from "./useOmeZarrImageViewer";
import { Region } from "@idetik/core";
import {
  Button,
  Tag,
  InputSlider,
  LoadingIndicator,
} from "@czi-sds/components";
import cns from "classnames";

interface OmeZarrViewerContainerProps {
  sourceUrl: string;
  region: Region;
  seriesDimensionName: string;
  allSlicesSizeEstimate?: string;

  // Optional callbacks for instrumentation
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
  console.log("[Viewer] Rendering Renderer with", {
    camera,
    layerManager,
    imageLayer,
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
        "border",
        "border-solid",
        "border-black",
        "min-h-0",
        "relative"
      )}
    >
      {/* Main Image Viewer (fills space behind everything else) */}
      <Renderer
        layerManager={layerManager}
        camera={camera}
        cameraControls="panzoom"
      />

      {/* Overlay Controls */}
      {imageLayer && (
        <div className={cns("absolute", "top-0", "left-0", "w-3/4")}>
          <ChannelControlsList
            layer={imageLayer}
            controlProps={controlProps}
            resetCallback={resetChannelsCallback}
          />
        </div>
      )}

      {/* Bottom-right overlay */}
      <div
        className={cns(
          "absolute",
          "bottom-0",
          "right-0",
          "w-full",
          "px-5",
          "py-3",
          "flex",
          "flex-col",
          "items-end"
        )}
      >
        {/* Slice Label + Load Button */}
        <div
          className={cns(
            "flex",
            "justify-end",
            "items-center",
            "w-full",
            "h-6"
          )}
        >
          {!allSlicesLoaded && (
            <Button
              sdsType="primary"
              sdsStyle="rounded"
              size="small"
              disabled={loading}
              onClick={loadAllSlicesCallback}
            >
              {allSlicesSizeEstimate
                ? `Load 3D high-res (${allSlicesSizeEstimate})`
                : "Load 3D high-res"}
            </Button>
          )}
          <div className="flex justify-end w-1/3">
            {!loading ? (
              <Tag
                label={`slice ${zIndex}/${zRange[1] - zRange[0]}`}
                sdsStyle="square"
                sdsType="secondary"
                hover={false}
              />
            ) : (
              <LoadingIndicator sdsStyle="tag" />
            )}
          </div>
        </div>

        {/* Z-index slider */}
        {allSlicesLoaded && (
          <div
            className={cns(
              "w-2/3",
              "flex",
              "justify-center",
              "items-center",
              "gap-2"
            )}
          >
            <InputSlider
              min={0}
              max={1}
              step={1 / (zRange[1] - zRange[0])}
              value={zValue}
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
