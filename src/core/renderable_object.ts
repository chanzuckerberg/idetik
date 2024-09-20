import { Node } from "core/node";
import { Geometry } from "./geometry";
import { Texture } from "@/objects/textures/texture";

export abstract class RenderableObject extends Node {
  private geometry_ = new Geometry();
  private textures_: Texture[] = [];

  public addTexture(texture: Texture) {
    this.textures_.push(texture);
  }

  public get geometry() {
    return this.geometry_;
  }

  public get textures() {
    return this.textures_;
  }

  public set geometry(geometry: Geometry) {
    this.geometry_ = geometry;
  }
}
