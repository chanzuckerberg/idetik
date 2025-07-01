import { Node } from "../core/node";
import { Geometry } from "../core/geometry";
import { Texture } from "../objects/textures/texture";
import { TrsTransform } from "../core/transforms";

import { Shader } from "../renderers/shaders";

export type Primitive = "triangles" | "points";

export abstract class RenderableObject extends Node {
  private readonly textures_: Texture[] = [];
  private readonly transform_ = new TrsTransform();
  private geometry_ = new Geometry();
  private programName_: Shader | null = null;
  private primitive_: Primitive = "triangles";
  private wireframeOnShaded_ = false;

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
    if (this.wireframeOnShaded_) {
      this.generateWireframeIndicesIfNeeded(true);
    }
  }

  public set wireframeOnShaded(enabled: boolean) {
    this.wireframeOnShaded_ = enabled;
    if (this.wireframeOnShaded_) {
      this.generateWireframeIndicesIfNeeded(false);
    }
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

  private generateWireframeIndicesIfNeeded(forced: boolean) {
    const hasIndexData = this.geometry_.indexData.length > 0;
    const hasWireframeIndexData = this.geometry_.wireframeIndexData.length > 0;
    if (hasIndexData && (!hasWireframeIndexData || forced)) {
      this.geometry_.generateWireframeIndexData();
    }
  }

  /**
   * Get uniforms for shader program. Override in derived classes that need custom uniforms.
   * @returns Object containing uniform name-value pairs
   */
  public getUniforms(): Record<string, unknown> {
    return {}; // Default implementation returns no uniforms
  }
}
