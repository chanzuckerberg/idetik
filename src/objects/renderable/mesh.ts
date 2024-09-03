import { MeshSource } from "@/data/mesh_source";
import { RenderableObject } from "core/renderable_object";

export class Mesh extends RenderableObject {
  private source_: MeshSource;

  constructor(source: MeshSource) {
    super();
    this.source_ = source;
  }

  public get type() {
    return "Mesh";
  }

  public get source(): Readonly<MeshSource> {
    return this.source_;
  }

  public get index() {
    return this.source_.index;
  }
}
