import { Node } from "../core/node";
import { Geometry } from "../core/geometry";
import { WireframeGeometry } from "../core/wireframe_geometry";
import { Texture } from "../objects/textures/texture";
import { TrsTransform } from "../core/transforms";
import { Shader } from "../renderers/shaders";
import { Color } from "../core/color";

export abstract class RenderableObject extends Node {
  public wireframeEnabled = false;
  public wireframeColor = Color.WHITE;
  private readonly textures_: Texture[] = [];
  private staleTextures_: Texture[] = [];
  private readonly transform_ = new TrsTransform();
  private geometry_ = new Geometry();
  private wireframeGeometry_: WireframeGeometry | null = null;
  private programName_: Shader | null = null;

  public addTexture(texture: Texture) {
    this.textures_.push(texture);
  }

  public setTexture(index: number, texture: Texture) {
    if (index < 0 || index >= this.textures_.length) {
      throw new Error(
        `Texture index out of range: ${index}, number of textures: ${this.textures_.length}`
      );
    }
    this.staleTextures_.push(this.textures_[index]);
    this.textures_[index] = texture;
  }

  public popStaleTextures() {
    const stale = this.staleTextures_;
    this.staleTextures_ = [];
    return stale;
  }

  public get geometry() {
    return this.geometry_;
  }

  public get wireframeGeometry() {
    this.wireframeGeometry_ ??= new WireframeGeometry(this.geometry);
    return this.wireframeGeometry_;
  }

  public get textures() {
    return this.textures_;
  }

  public get transform() {
    return this.transform_;
  }

  public set geometry(geometry: Geometry) {
    this.geometry_ = geometry;
    this.wireframeGeometry_ = null;
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

  /**
   * Get uniforms for shader program. Override in derived classes that need custom uniforms.
   * @returns Object containing uniform name-value pairs
   */
  public getUniforms(): Record<string, unknown> {
    return {}; // Default implementation returns no uniforms
  }
}
