import { Idetik, OrthographicCamera } from "@";

type ScaleBarProps = {
  textDiv: HTMLDivElement;
  lineDiv: HTMLDivElement;
  unit?: string;
};

export class ScaleBar {
  private textDiv_: HTMLDivElement;
  private lineDiv_: HTMLDivElement;
  private unit_: string;

  constructor(props: ScaleBarProps) {
    this.textDiv_ = props.textDiv;
    this.lineDiv_ = props.lineDiv;
    this.unit_ = props.unit ?? "";
  }

  public update(idetik: Idetik, _timestamp?: DOMHighResTimeStamp): void {
    const camera = idetik.camera;
    if (camera.type !== "OrthographicCamera") {
      console.error("ScaleBar can only be used with OrthographicCamera");
      return;
    }
    const orthoCamera = camera as OrthographicCamera;

    const cameraWidthWorld =
      orthoCamera.transform.scale[0] * orthoCamera.viewportSize[0];
    const unitPerCanvasPixel = cameraWidthWorld / idetik.canvas.clientWidth;

    // The use of clientWidth assumes that the lineDiv has no padding,
    // which is true in this example. If similar code is used elsewhere,
    // the lack of padding should be asserted and or enforced.
    const lineWidth = this.lineDiv_.clientWidth;
    const lineWidthWorld = lineWidth * unitPerCanvasPixel;

    this.textDiv_.textContent = `${lineWidthWorld.toFixed(2)} ${this.unit_}`;
  }
}
