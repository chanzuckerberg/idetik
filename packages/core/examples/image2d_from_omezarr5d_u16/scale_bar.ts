import { Idetik, OrthographicCamera } from "@";

type ScaleBarProps = {
  boxDiv: HTMLDivElement;
  textDiv: HTMLDivElement;
  barDiv: HTMLDivElement;
  boxProportion?: number;
  barProportion?: number;
  unit?: string;
};

export class ScaleBar {
  private boxDiv_: HTMLDivElement;
  private textDiv_: HTMLDivElement;
  private barDiv_: HTMLDivElement;
  private boxProportion_: number;
  private barProportion_: number;
  private unit_: string;

  constructor(props: ScaleBarProps) {
    this.boxDiv_ = props.boxDiv;
    this.textDiv_ = props.textDiv;
    this.barDiv_ = props.barDiv;
    this.boxProportion_ = props.boxProportion ?? 0.25;
    this.barProportion_ = props.barProportion ?? 0.9;
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
    this.boxDiv_.style.width = `${this.boxProportion_ * 100}%`;
    this.barDiv_.style.width = `${this.barProportion_ * 100}%`;
    const barWidth = this.boxProportion_ * this.barProportion_ * cameraWidth;
    this.textDiv_.textContent = `${(barWidth).toFixed(2)} ${this.unit_}`;
  }
}