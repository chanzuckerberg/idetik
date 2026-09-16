import box from "../../icons/box.svg?raw";
import zoom from "../../icons/zoom.svg?raw";
import layout from "../../icons/layout.svg?raw";
import play from "../../icons/play.svg?raw";
import tag from "../../icons/tag.svg?raw";

export type Example = {
  id: string;
  title: string;
  icon: string;
};

export const examples: Example[] = [
  { id: "volume-rendering", title: "Volume Rendering", icon: box },
  { id: "multiscale-image", title: "Multiscale Image", icon: zoom },
  { id: "multiple-viewports", title: "Multiple Viewports", icon: layout },
  { id: "temporal-playback", title: "Temporal Playback", icon: play },
  { id: "segmentation-labels", title: "Segmentation Labels", icon: tag },
];
