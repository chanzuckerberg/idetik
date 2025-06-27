import { Camera } from "../objects/cameras/camera";
import { OrthographicCamera } from "../objects/cameras/orthographic_camera";

export type ScaleBarProps = {
  textDiv: HTMLDivElement;
  barDiv: HTMLDivElement;
  unit?: string;
};

export class ScaleBar {
  private textDiv_: HTMLDivElement;
  private barDiv_: HTMLDivElement;
  private unit_: string;

  constructor(props: ScaleBarProps) {
    this.textDiv_ = props.textDiv;
    this.barDiv_ = props.barDiv;
    this.unit_ = props.unit ?? "";
  }

  public update(canvasWidth: number, camera: Camera): void {
    if (camera.type !== "OrthographicCamera") {
      throw new Error("ScaleBar can only be used with OrthographicCamera");
    }
    const orthoCamera = camera as OrthographicCamera;
    const cameraWidth =
      orthoCamera.transform.scale[0] * orthoCamera.viewportSize[0];
    // TODO: assert that neither the barDiv nor idetik's canvas has padding,
    // which is included in clientWidth.
    const barWidth =
      ((this.barDiv_.clientWidth * window.devicePixelRatio) / canvasWidth) *
      cameraWidth;
    this.textDiv_.textContent = `${barWidth.toFixed(2)} ${this.unit_}`;
  }
}
