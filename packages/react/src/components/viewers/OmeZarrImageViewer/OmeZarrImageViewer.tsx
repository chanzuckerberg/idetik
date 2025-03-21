import { useEffect, useState } from "react";
import cns from "classnames";
import CircularProgress from "@mui/material/CircularProgress";
import {
    ImageLayer,
    LayerManager,
    OmeZarrImageSource,
    OrthographicCamera,
    Region,
    loadOmeroChannels,
} from "@idetik/core";

import { Renderer } from "components/viewers/OmeZarrImageViewer/components/Renderer";
import { ChannelControlsList } from "components/viewers/OmeZarrImageViewer/components/ChannelControlsList";
import { ChannelControlProps } from "components/viewers/OmeZarrImageViewer/components/ChannelControlsList/components/ChannelControl";
import { omeroToChannelProps, omeroToControlProps } from "components/viewers/OmeZarrImageViewer/utils";
interface OmeZarrImageViewerProps {
    sourceUrl: string;
    region: Region;
    scale?: number;
}

export function OmeZarrImageViewer({
    sourceUrl,
    region,
    scale,
}: OmeZarrImageViewerProps) {
    const [layerManager, _setLayerManager] = useState<LayerManager>(
        new LayerManager()
    );
    const [camera, _setCamera] = useState<OrthographicCamera>(
        new OrthographicCamera(0, 128, 0, 128)
    );
    const [imageLayer, setImageLayer] = useState<ImageLayer | null>(null);
    const [source, setSource] = useState<OmeZarrImageSource | null>(null);
    const [loading, setLoading] = useState(true);
    const [controlProps, setControlProps] = useState<
        Partial<ChannelControlProps>[]
    >([]);

    useEffect(() => {
        const source = new OmeZarrImageSource(sourceUrl, scale);
        setSource(source);
    }, [sourceUrl, scale]);

    useEffect(() => {
        setLoading(true);
        const getLayer = async () => {
            if (!source) return;
            // TODO: may need to accept channel properties to be possibly overridden here
            // (i.e. for initial visibility, custom colors)
            const omeroChannels = await loadOmeroChannels(sourceUrl);
            const channelProps = omeroToChannelProps(omeroChannels);
            setControlProps(omeroToControlProps(omeroChannels));
            const layer = new ImageLayer({ source, region, channelProps });
            layer.addStateChangeCallback(() => {
                if (layer.state === "ready") {
                    setLoading(false);
                    if (layer.extent !== undefined) {
                        camera.setFrame(0, layer.extent.x, 0, layer.extent.y);
                        camera.update();
                    }
                }
            });
            setImageLayer(layer);
        };
        getLayer();
    }, [source, sourceUrl, region, camera]);

    useEffect(() => {
        if (imageLayer) {
            layerManager.layers.length = 0;
            layerManager.add(imageLayer);
        }
    }, [imageLayer, layerManager]);

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
            <Renderer
                layerManager={layerManager}
                camera={camera}
                cameraControls="panzoom"
            />
            {loading && (
                <div className={cns("absolute", "top-1/2", "left-1/2")}>
                    <CircularProgress />
                </div>
            )}
            {imageLayer && (
                <div className={cns("absolute", "top-0", "left-0", "w-[25em]")}>
                    <ChannelControlsList layer={imageLayer} controlProps={controlProps} />
                </div>
            )}
        </div>
    );
}