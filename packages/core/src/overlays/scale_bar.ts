import { Idetik } from "../idetik";
import { OrthographicCamera } from "../objects/cameras/orthographic_camera";

export class ScaleBar {
  private cameraWidth_: number = 0;

  public get cameraWidth(): number {
    return this.cameraWidth_;
  }

  public update(idetik: Idetik): void {
    const camera = idetik.camera;
    if (camera.type !== "OrthographicCamera") {
      throw new Error("ScaleBar can only be used with OrthographicCamera");
    }
    const orthoCamera = camera as OrthographicCamera;
    const cameraWidth =
      orthoCamera.transform.scale[0] * orthoCamera.viewportSize[0];
    if (cameraWidth !== this.cameraWidth_) {
      this.cameraWidth_ = cameraWidth;
    }
  }
}
