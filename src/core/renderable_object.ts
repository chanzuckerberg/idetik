import { Node } from "../core/node";
import { Geometry } from "../core/geometry";
import { WireframeGeometry } from "../core/wireframe_geometry";
import { Texture } from "../objects/textures/texture";
import { TrsTransform } from "../core/transforms";
import { Shader } from "../renderers/shaders";
import { Color } from "../core/color";
import { CullingMode } from "../renderers/webgl_state";

export abstract class RenderableObject extends Node {
  public wireframeEnabled = false;
  public wireframeColor = Color.WHITE;
  public depthTest = true;
  private readonly textures_: Texture[] = [];
  private staleTextures_: Texture[] = [];
  private readonly transform_ = new TrsTransform();
  private geometry_ = new Geometry();
  private wireframeGeometry_: WireframeGeometry | null = null;
  private programName_: Shader | null = null;
  private cullFaceMode_: CullingMode = "none";

  public setTexture(index: number, texture: Texture) {
    const oldTexture = this.textures_[index];
    if (oldTexture !== undefined) {
      this.staleTextures_.push(oldTexture);
    }
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

  public get programName(): Shader | null {
    return this.programName_;
  }

  public get boundingBox() {
    const box = this.geometry_.boundingBox.clone();
    box.applyTransform(this.transform_.matrix);
    return box;
  }

  protected set programName(programName: Shader) {
    this.programName_ = programName;
  }

  public get cullFaceMode() {
    return this.cullFaceMode_;
  }

  public set cullFaceMode(mode: CullingMode) {
    this.cullFaceMode_ = mode;
  }

  /**
   * Get uniforms for shader program. Override in derived classes that need custom uniforms.
   * @returns Object containing uniform name-value pairs
   */
  public getUniforms(): Record<string, unknown> {
    return {}; // Default implementation returns no uniforms
  }
}
