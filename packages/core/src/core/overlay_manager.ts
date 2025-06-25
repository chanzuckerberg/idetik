import { Overlay } from "./overlay";

export class OverlayManager {
  private readonly overlays_: Overlay[] = [];

  public add(overlay: Overlay) {
    this.overlays_.push(overlay);
  }

  public remove(overlay: Overlay) {
    const index = this.overlays_.indexOf(overlay);
    if (index > -1) this.overlays_.splice(index, 1);
  }

  public removeAll() {
    this.overlays_.length = 0;
  }

  public get overlays(): readonly Overlay[] {
    return this.overlays_;
  }
}
