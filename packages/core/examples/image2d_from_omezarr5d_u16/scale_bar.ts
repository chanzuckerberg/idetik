import { Idetik, OrthographicCamera } from "@";

type ScaleBarProps = {
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

  public update(idetik: Idetik): void {
    const camera = idetik.camera;
    if (camera.type !== "OrthographicCamera") {
      throw new Error("ScaleBar can only be used with OrthographicCamera");
    }
    const orthoCamera = camera as OrthographicCamera;
    const cameraWidth =
      orthoCamera.transform.scale[0] * orthoCamera.viewportSize[0];
    const barWidth = (this.barDiv_.offsetWidth / idetik.width) * cameraWidth;
    this.textDiv_.textContent = `${barWidth.toFixed(2)} ${this.unit_}`;
  }
}
