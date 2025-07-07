import { Node } from "../core/node";
import { Geometry } from "../core/geometry";
import { Texture } from "../objects/textures/texture";
import { TrsTransform } from "../core/transforms";

import { Shader } from "../renderers/shaders";

export type Primitive = "triangles" | "points" | "lines";

export abstract class RenderableObject extends Node {
  public wireframeEnabled = false;
  private readonly textures_: Texture[] = [];
  private readonly transform_ = new TrsTransform();
  private geometry_ = new Geometry();
  private programName_: Shader | null = null;
  private primitive_: Primitive = "triangles";

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

  public get programName(): Shader {
    if (this.programName_ === null) {
      throw new Error("Program name not set");
    }
    return this.programName_;
  }

  protected set programName(programName: Shader) {
    this.programName_ = programName;
  }

  public get primitive(): Primitive {
    return this.primitive_;
  }

  protected set primitive(primitive: Primitive) {
    this.primitive_ = primitive;
  }

  /**
   * Get uniforms for shader program. Override in derived classes that need custom uniforms.
   * @returns Object containing uniform name-value pairs
   */
  public getUniforms(): Record<string, unknown> {
    return {}; // Default implementation returns no uniforms
  }
}
