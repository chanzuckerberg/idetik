declare module '@idetik/core' {
  export type LayerState = 'loading' | 'ready' | 'error';
  
  export interface Region {
    dimension: string;
    index: { type: string; value?: number };
  }

  export interface ChannelProps {
    visible: boolean;
    color: [number, number, number];
    contrastLimits: [number, number];
  }

  export interface OmeroChannel {
    window: {
      start: number;
      end: number;
      min: number;
      max: number;
    };
    color: string;
    active: boolean;
    label?: string;
  }

  export interface Extent {
    x: number;
    y: number;
    z?: number;
  }

  export class LayerManager {
    constructor();
    add(layer: ImageSeriesLayer): void;
  }

  export class OmeZarrImageSource {
    constructor(url: string);
    open(): Promise<any>;
  }

  export class ImageSeriesLayer {
    constructor(options: {
      source: OmeZarrImageSource;
      region: Region;
      seriesDimensionName: string;
      channelProps: ChannelProps[];
    });
    
    extent?: Extent;
    setIndex(index: number): void;
    setChannelProps(props: ChannelProps[]): void;
    addStateChangeCallback(callback: (state: LayerState) => void): void;
    removeStateChangeCallback(callback: (state: LayerState) => void): void;
    preloadSeries(): Promise<void>;
  }

  export class OrthographicCamera {
    constructor(left: number, right: number, bottom: number, top: number, near?: number, far?: number);
    position: { x: number; y: number; z: number };
    setFrame(left: number, right: number, bottom: number, top: number): void;
    update(): void;
  }

  export class WebGLRenderer {
    constructor(selector: string);
    render(layerManager: LayerManager, camera: OrthographicCamera): void;
    setControls(controls: PanZoomControls): void;
  }

  export class PanZoomControls {
    constructor(camera: OrthographicCamera, target: { x: number; y: number; z: number });
  }
}

// Fix for setTimeout return type
interface Window {
  setTimeout(handler: TimerHandler, timeout?: number, ...arguments: any[]): number;
  clearTimeout(handle?: number): void;
}

