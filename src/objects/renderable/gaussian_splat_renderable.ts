import { mat4 } from "gl-matrix";

import { RenderableObject } from "../../core/renderable_object";
import { PlaneGeometry } from "../geometry/plane_geometry";
import { Texture2D } from "../textures/texture_2d";
import { GaussianSplats, SPLAT_WORDS } from "../../data/gaussian_splats";
import { sortSplatsBackToFront } from "../../utilities/splat_sort";

const MAX_TEXTURE_WIDTH = 4096;

function textureShape(texels: number) {
  const width = Math.max(1, Math.min(MAX_TEXTURE_WIDTH, texels));
  const height = Math.max(1, Math.ceil(texels / width));
  return { width, height };
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
  private readonly splats_: GaussianSplats;
  private readonly positions_: Float32Array;
  private readonly order_: Texture2D;
  private readonly orderData_: Uint32Array;
  private readonly depths_: Float32Array;

  /** @param splats - The splats to draw. */
  constructor(splats: GaussianSplats) {
    super();
    this.programName = "gaussianSplat";

    const geometry = new PlaneGeometry(2, 2, 1, 1);
    geometry.instanceCount = splats.count;
    this.geometry = geometry;

    this.splats_ = splats;
    this.positions_ = new Float32Array(splats.data.buffer);
    this.orderData_ = createIdentityOrder(splats.count);
    this.order_ = createOrderTexture(this.orderData_, splats.count);
    this.depths_ = new Float32Array(splats.count);
    this.setTexture(0, createSplatTexture(splats.data));
    this.setTexture(1, this.order_);
  }

  public get type() {
    return "GaussianSplatRenderable";
  }

  public override get boundingBox() {
    const box = this.splats_.extent.clone();
    box.applyTransform(this.transform.matrix);
    return box;
  }

  /**
   * Orders the splats back to front for a model-view matrix.
   *
   * @param modelView - The model-view matrix of the view to sort for.
   */
  public sortBackToFront(modelView: mat4) {
    const viewZ = [modelView[2], modelView[6], modelView[10], modelView[14]];
    sortSplatsBackToFront(
      this.positions_,
      SPLAT_WORDS,
      viewZ,
      this.orderData_,
      this.depths_
    );
    this.order_.data = this.orderData_;
  }

  public override getUniforms() {
    return { u_splats: 0, u_order: 1 };
  }
}

function createSplatTexture(data: Uint32Array) {
  const { width, height } = textureShape(data.length / 4);
  const padded = new Uint32Array(width * height * 4);
  padded.set(data);
  const texture = new Texture2D(padded, width, height);
  texture.dataFormat = "rgba";
  return texture;
}

function createIdentityOrder(count: number) {
  const { width, height } = textureShape(count);
  const order = new Uint32Array(width * height);
  for (let i = 0; i < count; i++) order[i] = i;
  return order;
}

function createOrderTexture(order: Uint32Array, count: number) {
  const { width, height } = textureShape(count);
  return new Texture2D(order, width, height);
}
