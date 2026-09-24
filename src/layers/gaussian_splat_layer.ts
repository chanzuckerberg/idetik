import { Layer } from "../core/layer";
import { Viewport } from "../core/viewport";
import { IdetikContext } from "../idetik";
import { Box3 } from "../math/box3";
import { GaussianSplats } from "../data/gaussian_splats";
import {
  GaussianSplatRenderable,
  splatOrderLength,
} from "../objects/renderable/gaussian_splat_renderable";
import type {
  SplatSortRequest,
  SplatSortResponse,
} from "../utilities/splat_sort_worker";
// "inline" import to ensure worker code works in dependent projects
// see https://github.com/vitejs/vite/issues/11672
import SplatSortWorker from "../utilities/splat_sort_worker.ts?worker&inline";

/**
 * Initialization properties for constructing a Gaussian splat layer.
 */
export type GaussianSplatLayerProps = {
  /** The splats to render. */
  splats: GaussianSplats;
  /** Layer opacity in `[0, 1]`. Defaults to `1`. */
  opacity?: number;
};

/**
 * A layer that renders 3D Gaussian splats.
 *
 * Each splat is drawn as a screen-space ellipse from its projected
 * covariance and composited back to front with premultiplied alpha. Splats
 * are depth sorted in a worker whenever the view changes, and the previous
 * order is drawn until the new one arrives.
 *
 * ```ts
 * const splats = await loadGaussianSplatsPly(url);
 * viewport.addLayer(new GaussianSplatLayer({ splats }));
 * ```
 *
 * @group Layers
 */
export class GaussianSplatLayer extends Layer {
  /** Identifies the layer type as `GaussianSplatLayer`. */
  public readonly type = "GaussianSplatLayer";

  private readonly renderable_ = new GaussianSplatRenderable();
  private splats_: GaussianSplats;
  private sortWorker_?: Worker;
  private version_ = 0;
  private sortInFlight_ = false;
  private sortedViewZ_: number[] | null = null;

  /**
   * Creates a layer that renders the given splats.
   *
   * @param props - Initialization properties.
   */
  constructor({ splats, opacity = 1 }: GaussianSplatLayerProps) {
    super({ opacity, blendMode: "premultipliedOver", occludes: false });
    this.splats_ = splats;
    this.renderable_.setSplats(splats, splatBounds(splats.bounds));
    this.addObject(this.renderable_);
    this.setState("ready");
  }

  /** The splats being rendered. */
  public get splats() {
    return this.splats_;
  }

  /**
   * Replaces the splats being rendered.
   *
   * @param splats - The new splats.
   */
  public set splats(splats: GaussianSplats) {
    this.splats_ = splats;
    this.renderable_.setSplats(splats, splatBounds(splats.bounds));
    this.sendCenters();
  }

  public update(viewport?: Viewport) {
    if (!viewport || this.sortInFlight_ || this.splats_.count === 0) return;
    const view = viewport.camera.viewMatrix;
    const viewZ = [view[2], view[6], view[10], view[14]];
    if (this.sortedViewZ_ && viewZNearlyEqual(viewZ, this.sortedViewZ_)) return;
    this.sortInFlight_ = true;
    this.sortedViewZ_ = viewZ;
    this.postSortRequest({ type: "sort", version: this.version_, viewZ });
  }

  protected override attach(_context: IdetikContext) {
    this.sortWorker_ = new SplatSortWorker();
    this.sortWorker_.addEventListener(
      "message",
      (e: MessageEvent<SplatSortResponse>) => this.onSorted(e.data)
    );
    this.sendCenters();
  }

  protected override detach(_context: IdetikContext) {
    this.sortWorker_?.terminate();
    this.sortWorker_ = undefined;
  }

  private sendCenters() {
    this.version_ += 1;
    this.sortInFlight_ = false;
    this.sortedViewZ_ = null;
    // Copy so the layer keeps its centers for later workers.
    const centers = this.splats_.centers.slice();
    this.postSortRequest(
      {
        type: "setCenters",
        version: this.version_,
        centers,
        orderLength: splatOrderLength(this.splats_.count),
      },
      [centers.buffer]
    );
  }

  private postSortRequest(
    request: SplatSortRequest,
    transfer: Transferable[] = []
  ) {
    this.sortWorker_?.postMessage(request, transfer);
  }

  private onSorted({ version, order }: SplatSortResponse) {
    if (version !== this.version_) return;
    this.sortInFlight_ = false;
    this.renderable_.setOrder(order);
  }
}

function viewZNearlyEqual(a: number[], b: number[]) {
  const directionEqual =
    Math.abs(a[0] - b[0]) < 1e-4 &&
    Math.abs(a[1] - b[1]) < 1e-4 &&
    Math.abs(a[2] - b[2]) < 1e-4;
  return directionEqual && Math.abs(a[3] - b[3]) <= 1e-4 * Math.abs(b[3]);
}

// Pads center bounds so culling keeps splats that extend past them.
function splatBounds(bounds: Box3) {
  const box = bounds.clone();
  const size = Math.max(
    box.max[0] - box.min[0],
    box.max[1] - box.min[1],
    box.max[2] - box.min[2]
  );
  const pad = 0.05 * size;
  for (let i = 0; i < 3; i++) {
    box.min[i] -= pad;
    box.max[i] += pad;
  }
  return box;
}
