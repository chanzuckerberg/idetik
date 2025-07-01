import { Camera } from "../objects/cameras/camera";
import { OrthographicCamera } from "../objects/cameras/orthographic_camera";

export type ScaleBarProps = {
  containerDiv: HTMLDivElement;
  textDiv: HTMLDivElement;
  lineDiv: HTMLDivElement;
  unit?: string;
};

export class ScaleBar {
  private readonly containerDiv_: HTMLDivElement;
  private readonly textDiv_: HTMLDivElement;
  private readonly lineDiv_: HTMLDivElement;
  private readonly unit_: string;
  private lastMaxLineWidthWorld_?: number;

  constructor(props: ScaleBarProps) {
    this.containerDiv_ = props.containerDiv;
    this.textDiv_ = props.textDiv;
    this.lineDiv_ = props.lineDiv;
    this.unit_ = props.unit ?? "";
  }

  public update(canvasWidth: number, camera: Camera): void {
    if (camera.type !== "OrthographicCamera") {
      throw new Error("ScaleBar can only be used with OrthographicCamera");
    }
    const orthoCamera = camera as OrthographicCamera;
    const cameraWidthWorld =
      orthoCamera.transform.scale[0] * orthoCamera.viewportSize[0];
    const unitPerCanvasPixel = cameraWidthWorld / canvasWidth;
    // TODO: assert that neither the container div, line div, nor idetik's canvas
    // has padding or border which affects the width calculation here.
    const maxLineWidth =
      this.containerDiv_.clientWidth * window.devicePixelRatio;
    const maxLineWidthWorld = maxLineWidth * unitPerCanvasPixel;
    if (maxLineWidthWorld !== this.lastMaxLineWidthWorld_) {
      this.lastMaxLineWidthWorld_ = maxLineWidthWorld;
      const lineWidthWorld = scientificFloor(maxLineWidthWorld);
      const lineProportion = lineWidthWorld.value / maxLineWidthWorld;
      this.lineDiv_.style.width = `${lineProportion * 100}%`;
      const numDecimalPlaces = Math.max(0, -lineWidthWorld.exponent);
      this.textDiv_.textContent = `${lineWidthWorld.value.toFixed(numDecimalPlaces)} ${this.unit_}`;
    }
  }
}

// Converts the given number to the greatest value of the form x = y 10^z
// that is less than or equal to the given number, where y is a positive integer
// and z is an integer.
function scientificFloor(x: number): {
  value: number;
  coefficient: number;
  exponent: number;
} {
  const z = Math.floor(Math.log10(Math.abs(x)));
  const base = Math.pow(10, z);
  const y = Math.floor(x / base);
  return {
    value: y * base,
    coefficient: y,
    exponent: z,
  };
}
