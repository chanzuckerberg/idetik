import { Node } from "core/node";
import { Geometry } from "core/geometry";
import { Texture } from "objects/textures/texture";
import { Transform } from "core/transform";

export abstract class RenderableObject extends Node {
  private geometry_ = new Geometry();
  private textures_: Texture[] = [];
  private transform_ = new Transform();

  public addTexture(texture: Texture) {
    this.textures_.push(texture);
  }

  public get geometry() {
    return this.geometry_;
  }

  public get textures() {
    return this.textures_;
  }

  public get transform() {
    return this.transform_;
  }

  public set geometry(geometry: Geometry) {
    this.geometry_ = geometry;
  }
}
