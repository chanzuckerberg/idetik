import { GaussianSplats, loadGaussianSplatsPly } from "./gaussian_splats";

/**
 * One dimension of the splat centers.
 */
export type GaussianSplatDimension = {
  /** The dimension name. */
  name: string;
  /** The extent of the splat centers along this dimension. */
  range: [number, number];
};

/**
 * A set of 3D Gaussian splats to render with a {@link GaussianSplatLayer}.
 *
 * Layers created from the same source share its loaded data.
 *
 * ```ts
 * const source = await GaussianSplatSource.fromPly(url);
 * const layer = new GaussianSplatLayer({ source });
 * ```
 *
 * @group Data Loading
 */
export class GaussianSplatSource {
  private readonly splats_: GaussianSplats;

  private constructor(splats: GaussianSplats) {
    this.splats_ = splats;
  }

  /**
   * Loads splats from a PLY file in the layout written by the reference 3D
   * Gaussian Splatting implementation and compatible tools.
   *
   * Color comes from the degree-0 spherical harmonic only, so it does not
   * vary with view direction.
   *
   * @param url - The URL of the PLY file.
   */
  public static async fromPly(url: string) {
    return new GaussianSplatSource(await loadGaussianSplatsPly(url));
  }

  /** The number of splats. */
  public get splatCount() {
    return this.splats_.count;
  }

  /**
   * Returns the dimensions of the splat centers in storage order. PLY
   * sources have `x`, `y`, and `z`.
   */
  public getDimensions(): GaussianSplatDimension[] {
    const { min, max } = this.splats_.bounds;
    return ["x", "y", "z"].map((name, i) => ({
      name,
      range: [min[i], max[i]],
    }));
  }

  /** @hidden */
  public get splats(): GaussianSplats {
    return this.splats_;
  }
}
