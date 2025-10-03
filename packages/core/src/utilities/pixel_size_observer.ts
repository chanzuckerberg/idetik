export class PixelSizeObserver {
  private elements_: ReadonlyArray<HTMLElement>;
  private resizeObserver_?: ResizeObserver;
  private mediaQuery_?: MediaQueryList;
  private onMediaQueryChange_?: (
    this: MediaQueryList,
    ev: MediaQueryListEvent
  ) => void;
  public changed = false;

  constructor(elements: ReadonlyArray<HTMLElement> = []) {
    this.elements_ = elements;
  }

  public connect() {
    this.resizeObserver_ = new ResizeObserver(() => {
      this.changed = true;
    });

    for (const element of this.elements_) {
      this.resizeObserver_.observe(element);
    }

    this.startDevicePixelRatioObserver();
  }

  private startDevicePixelRatioObserver() {
    // this media query needs to be updated after a change is detected, so we use a one-time
    // event listener that re-registers itself with the new value
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio#monitoring_screen_resolution_or_zoom_level_changes
    this.mediaQuery_ = matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`
    );
    this.onMediaQueryChange_ = () => {
      this.changed = true;
      this.startDevicePixelRatioObserver();
    };
    this.mediaQuery_.addEventListener("change", this.onMediaQueryChange_, {
      once: true,
    });
  }

  public disconnect() {
    this.resizeObserver_?.disconnect();
    if (this.mediaQuery_ && this.onMediaQueryChange_) {
      this.mediaQuery_.removeEventListener("change", this.onMediaQueryChange_);
    }
  }
}
