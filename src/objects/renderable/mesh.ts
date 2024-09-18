import { RenderableObject } from "core/renderable_object";
import { Geometry } from "core/geometry";
import { Texture } from "objects/textures/texture";

export class Mesh extends RenderableObject {
  private texture_: Texture | null;

  constructor(geometry: Geometry | null, texture: Texture | null = null) {
    super();

    // This constructor logic is temporary. In the future, we'll implement a
    // material system that may include an optional texture. Every mesh will
    // have a default material, similar to how each mesh has a geometry, even
    // if it doesn't contain data initially.
    this.texture_ = texture;

    if (geometry) {
      this.geometry_ = geometry;
    }
  }

  public get type() {
    return "Mesh";
  }

  public get texture() {
    return this.texture_;
  }
}
