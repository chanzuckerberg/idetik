import { MeshSource } from "../../data/mesh_source";
import { RenderableObject } from "../../core/renderable_object";
import { Texture } from "../textures/texture";

export class Mesh extends RenderableObject {
  private source_: MeshSource;
  private texture_: Texture | null;

  constructor(source: MeshSource, texture: Texture | null = null) {
    super();
    this.source_ = source;
    this.texture_ = texture;
  }

  public get type() {
    return "Mesh";
  }

  public get source(): Readonly<MeshSource> {
    return this.source_;
  }

  public get texture() {
    return this.texture_;
  }

  public get index() {
    return this.source_.index;
  }
}
