import { Node } from "core/node";
import { Geometry } from "./geometry";

export abstract class RenderableObject extends Node {
  protected geometry_ = new Geometry();

  public get geometry() {
    return this.geometry_;
  }
}
