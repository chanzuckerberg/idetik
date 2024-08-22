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

  /*
    The concept here is to decouple data sources from the renderer. Renderable
    objects should expose data and configuration to the renderer through
    accessor methods. This approach feels like a lot of boilerplate, and its
    long-term stability and necessity are uncertain. For now, I'm treating
    renderable objects and data sources as temporary components until we gain
    more insight into efficient data loading patterns (such as chunking).
  */
  public get vertices() {
    return this.source_.getAttribute("vertices");
  }

  public get normals() {
    return this.source_.getAttribute("normals");
  }

  public get uvs() {
    return this.source_.getAttribute("uvs");
  }

  public get index() {
    return this.source_.getIndex();
  }
}
