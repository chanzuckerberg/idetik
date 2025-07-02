type FpsOverlayProps = {
  textDiv: HTMLDivElement;
};

export class FpsOverlay {
  textDiv_: HTMLDivElement;
  msSinceLastUpdate_: number = 0;
  lastTimestamp_?: DOMHighResTimeStamp;

  constructor(props: FpsOverlayProps) {
    this.textDiv_ = props.textDiv;
  }

  public update(_idetik: unknown, timestamp?: DOMHighResTimeStamp): void {
    if (timestamp === undefined) {
      return;
    }
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
    this.textDiv_.textContent = `FPS: ${(1000 / elapsedMs).toFixed(0)}`;
    this.msSinceLastUpdate_ = 0;
  }
}
