import { ProjectedLineLayer } from "@idetik/core"
import { Button } from "@czi-sds/components";
import { useIdetik } from "./hooks/useIdetik";
import { IdetikCanvas } from "./IdetikCanvas";
import { IdetikLayerList } from "./IdetikLayerList";
import { RefObject } from "react";

interface AppProps {
  canvasRef: RefObject<HTMLCanvasElement>;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.50776405003785 degrees


/** Demo. */
export default function App({ canvasRef }: AppProps) {
  const contextValue = useIdetik();

  console.debug("App::render", { contextValue });

  const createLayer = () => {
    if (!contextValue) {
      console.error("Context value is not available");
      return;
    }
    const basePath = [[-1, 0, 0], [1, 0, 0]];
    const angle = contextValue.idetik.layerManager.layers.length * GOLDEN_ANGLE;
    const path: [number, number, number][] = basePath.map((point) => {
      const x = point[0] * Math.cos(angle) - point[1] * Math.sin(angle);
      const y = point[0] * Math.sin(angle) + point[1] * Math.cos(angle);
      return [x, y, point[2]];
    });
    // set color based on angle, cycling through the hue spectrum
    const hue = (angle / (2 * Math.PI)) % 1; // Normalize angle to [0, 1]
    const saturation = 1.0; // Fixed saturation
    const lightness = 0.5; // Fixed lightness
    // convert HSL to RGB (fixed saturation and lightness)
    const color: [number, number, number] = hslToRgb(hue, saturation, lightness);
    const layer = new ProjectedLineLayer([{
      path,
      color,
      width: 0.05,
    }]);
    contextValue.addLayer(layer);
    console.log("Layer added:", layer);
    console.log("Current layers:", contextValue.idetik.layerManager.layers);
    console.log("Camera:", contextValue.idetik.camera);
  };

  return (
    <div className="h-screen flex">
      <div className="flex-1">
        <IdetikCanvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <div className="w-64 p-4 bg-gray-100 flex flex-col">
        <Button sdsStyle="minimal" onClick={createLayer}>
          Add Line Layer
        </Button>
        <IdetikLayerList />
      </div>
    </div>
  );
}

const hslToRgb = (hue: number, saturation: number, lightness: number): [number, number, number] => {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs((hue * 6) % 2 - 1));
  const m = lightness - c / 2;

  let r: number, g: number, b: number;

  if (hue < 1 / 6) {
    [r, g, b] = [c, x, 0];
  } else if (hue < 2 / 6) {
    [r, g, b] = [x, c, 0];
  } else if (hue < 3 / 6) {
    [r, g, b] = [0, c, x];
  } else if (hue < 4 / 6) {
    [r, g, b] = [0, x, c];
  } else if (hue < 5 / 6) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }

  return [r + m, g + m, b + m];
};

