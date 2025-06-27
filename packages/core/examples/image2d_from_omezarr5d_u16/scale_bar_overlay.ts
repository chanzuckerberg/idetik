import { Idetik, OrthographicCamera } from "@";

type ScaleBarOverlayProps = {
  textDiv: HTMLDivElement;
  barDiv: HTMLDivElement;
  unit?: string;
};

export class ScaleBarOverlay {
  private textDiv_: HTMLDivElement;
  private barDiv_: HTMLDivElement;
  private unit_: string;

  constructor(props: ScaleBarOverlayProps) {
    this.textDiv_ = props.textDiv;
    this.barDiv_ = props.barDiv;
    this.unit_ = props.unit ?? "";
  }

  public update(idetik: Idetik, _timestamp: DOMHighResTimeStamp): void {
    const camera = idetik.camera;
    if (camera.type !== "OrthographicCamera") {
      throw new Error("ScaleBar can only be used with OrthographicCamera");
    }
    const orthoCamera = camera as OrthographicCamera;
    const cameraWidth =
      orthoCamera.transform.scale[0] * orthoCamera.viewportSize[0];
    // TODO: assert that neither the barDiv nor idetik's canvas has padding,
    // which is included in clientWidth.
    const barWidth = (this.barDiv_.clientWidth * window.devicePixelRatio / idetik.width) * cameraWidth;
    this.textDiv_.textContent = `${barWidth.toFixed(2)} ${this.unit_}`;
  }
}
