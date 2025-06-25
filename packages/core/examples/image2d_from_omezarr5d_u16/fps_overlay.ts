import { Idetik } from "@";

type FpsOverlayProps = {
  fpsDiv: HTMLDivElement;
};

export class FpsOverlay {
  fpsDiv_: HTMLDivElement;
  msSinceLastUpdate_: number = 0;
  lastTimestamp_?: DOMHighResTimeStamp;

  constructor(props: FpsOverlayProps) {
    this.fpsDiv_ = props.fpsDiv;
  }

  public update(_idetik: Idetik, timestamp: DOMHighResTimeStamp): void {
    if (this.lastTimestamp_ === undefined) {
      this.lastTimestamp_ = timestamp;
      return;
    }
    const elapsedMs = timestamp - this.lastTimestamp_;
    this.lastTimestamp_ = timestamp;
    if (this.msSinceLastUpdate_ < 1000) {
      this.msSinceLastUpdate_ += elapsedMs;
      return;
    }
    this.fpsDiv_.innerText = `FPS: ${(1000 / elapsedMs).toFixed(0)}`;
    this.msSinceLastUpdate_ = 0;
  }
}
