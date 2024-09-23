import { mat4, vec2, vec3 } from "gl-matrix";
import { Node } from "core/node";
import { Geometry } from "./geometry";
import { Texture } from "@/objects/textures/texture";

// TODO: make this a single type
export type UniformType = "mat4" | "vec2" | "vec3" | "number";
export type UniformValue = mat4 | vec2 | vec3 | number;

export abstract class RenderableObject extends Node {
  private geometry_ = new Geometry();
  private textures_: Texture[] = [];
  private uniforms_: Map<string, [UniformType, UniformValue]> = new Map();

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

  protected addUniform(name: string, type: UniformType, value: UniformValue) {
    this.uniforms_.set(name, [type, value]);
  }

  public get uniforms(): Map<string, [UniformType, UniformValue]> {
    return this.uniforms_;
  }
}
