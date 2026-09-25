import { vec3 } from "gl-matrix";

import { Layer } from "../core/layer";
import { Viewport } from "../core/viewport";
import { Box3 } from "../math/box3";
import { GaussianSplats, loadGaussianSplatsPly } from "../data/gaussian_splats";
import {
  GaussianSplatRenderable,
  splatOrderLength,
} from "../objects/renderable/gaussian_splat_renderable";
import { sortSplatsBackToFront } from "../utilities/splat_sort";

// Re-sort when the view direction has rotated more than one degree.
const RESORT_COS_ANGLE = Math.cos((1 * Math.PI) / 180);

/**
 * Initialization properties for a Gaussian splat layer.
 */
export type GaussianSplatLayerProps = {
  /** Layer opacity in `[0, 1]`. Defaults to `1`. */
  opacity?: number;
};

/**
 * A layer that renders 3D Gaussian splats.
 *
 * Each splat is drawn as a screen-space ellipse from its projected
 * covariance and composited back to front with premultiplied alpha. Splats
 * are depth sorted whenever the view direction rotates by more than a degree.
 *
 * ```ts
 * const layer = await GaussianSplatLayer.fromPly(url);
 * viewport.addLayer(layer);
 * ```
 *
 * @group Layers
 */
export class GaussianSplatLayer extends Layer {
  /** Identifies the layer type as `GaussianSplatLayer`. */
  public readonly type = "GaussianSplatLayer";

  private readonly renderable_ = new GaussianSplatRenderable();
  private readonly splats_: GaussianSplats;
  private readonly depths_: Float32Array;
  private sortedDirection_: vec3 | null = null;

  private constructor(
    splats: GaussianSplats,
    { opacity = 1 }: GaussianSplatLayerProps
  ) {
    super({ opacity, blendMode: "premultipliedOver", occludes: false });
    this.splats_ = splats;
    this.depths_ = new Float32Array(splats.count);
    this.renderable_.setSplats(splats, splatBounds(splats.bounds));
    this.addObject(this.renderable_);
    this.setState("ready");
  }

  /**
   * Loads splats from a PLY file in the layout written by the reference 3D
   * Gaussian Splatting implementation and compatible tools.
   *
   * Color comes from the degree-0 spherical harmonic only, so it does not
   * vary with view direction.
   *
   * @param url - The URL of the PLY file.
   * @param props - Initialization properties.
   */
  public static async fromPly(
    url: string,
    props: GaussianSplatLayerProps = {}
  ) {
    return new GaussianSplatLayer(await loadGaussianSplatsPly(url), props);
  }

  /** The number of splats in the layer. */
  public get splatCount() {
    return this.splats_.count;
  }

  /** World-space bounds of the splat centers. */
  public get bounds() {
    return this.splats_.bounds.clone();
  }

  public update(viewport?: Viewport) {
    if (!viewport || this.splats_.count === 0) return;
    const view = viewport.camera.viewMatrix;
    const viewZ = [view[2], view[6], view[10], view[14]];
    // Depth order depends only on the view direction, and changes slowly with
    // it, so small rotations reuse the previous order.
    const direction = vec3.fromValues(viewZ[0], viewZ[1], viewZ[2]);
    vec3.normalize(direction, direction);
    if (
      this.sortedDirection_ &&
      vec3.dot(direction, this.sortedDirection_) > RESORT_COS_ANGLE
    ) {
      return;
    }
    this.sortedDirection_ = direction;

    const order = new Uint32Array(splatOrderLength(this.splats_.count));
    sortSplatsBackToFront(this.splats_.centers, viewZ, order, this.depths_);
    this.renderable_.setOrder(order);
  }
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
