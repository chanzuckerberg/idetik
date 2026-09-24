import { RenderableObject } from "../../core/renderable_object";
import { Box3 } from "../../math/box3";
import { PlaneGeometry } from "../geometry/plane_geometry";
import { Texture2D } from "../textures/texture_2d";
import { GaussianSplats, SPLAT_WORDS } from "../../data/gaussian_splats";

const MAX_TEXTURE_WIDTH = 4096;

function textureShape(texels: number) {
  const width = Math.max(1, Math.min(MAX_TEXTURE_WIDTH, texels));
  const height = Math.max(1, Math.ceil(texels / width));
  return { width, height };
}

/**
 * Returns the length of an order buffer that fills the order texture for a
 * given number of splats.
 *
 * @param count - The number of splats.
 */
export function splatOrderLength(count: number) {
  const { width, height } = textureShape(count);
  return width * height;
}

/**
 * A set of 3D Gaussian splats drawn as instanced screen-space quads.
 *
 * Splat data lives in an integer texture read by the vertex shader, and a
 * second texture maps each instance to the splat it draws so the draw order
 * can change without re-uploading the splats.
 *
 * @group Renderables
 */
export class GaussianSplatRenderable extends RenderableObject {
  private splats_: Texture2D;
  private order_: Texture2D;
  private count_ = 0;
  private bounds_ = new Box3();

  constructor() {
    super();
    this.programName = "gaussianSplat";

    const geometry = new PlaneGeometry(2, 2, 1, 1);
    geometry.instanceCount = 0;
    this.geometry = geometry;

    this.splats_ = createSplatTexture(new Uint32Array(0), 0);
    this.order_ = createOrderTexture(0);
    this.setTexture(0, this.splats_);
    this.setTexture(1, this.order_);
  }

  public get type() {
    return "GaussianSplatRenderable";
  }

  /** The number of splats drawn. */
  public get count() {
    return this.count_;
  }

  public override get boundingBox() {
    return this.bounds_.clone();
  }

  /**
   * Replaces the splats and resets the draw order to storage order.
   *
   * @param splats - The splats to draw.
   * @param bounds - World-space bounds enclosing the splats.
   */
  public setSplats(splats: GaussianSplats, bounds: Box3) {
    this.markStaleTexture(this.splats_);
    this.markStaleTexture(this.order_);
    this.splats_ = createSplatTexture(splats.data, splats.count);
    this.order_ = createOrderTexture(splats.count);
    this.setTexture(0, this.splats_);
    this.setTexture(1, this.order_);
    this.count_ = splats.count;
    this.bounds_ = bounds.clone();
    this.geometry.instanceCount = splats.count;
  }

  /**
   * Sets the order in which splats are drawn.
   *
   * @param order - Splat indices in draw order, with length
   *   {@link splatOrderLength} of the current count.
   */
  public setOrder(order: Uint32Array) {
    if (order.length !== splatOrderLength(this.count_)) {
      throw new Error(
        `Order of length ${order.length} does not match ${this.count_} splats`
      );
    }
    this.order_.data = order;
  }

  public override getUniforms() {
    return { u_splats: 0, u_order: 1 };
  }
}

function createSplatTexture(data: Uint32Array, count: number) {
  const { width, height } = textureShape((count * SPLAT_WORDS) / 4);
  const padded = new Uint32Array(width * height * 4);
  padded.set(data.subarray(0, count * SPLAT_WORDS));
  const texture = new Texture2D(padded, width, height);
  texture.dataFormat = "rgba";
  return texture;
}

function createOrderTexture(count: number) {
  const { width, height } = textureShape(count);
  const order = new Uint32Array(width * height);
  for (let i = 0; i < count; i++) order[i] = i;
  return new Texture2D(order, width, height);
}
