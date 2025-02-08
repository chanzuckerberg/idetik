import { RenderableObject } from "core/renderable_object";
import { Geometry } from "core/geometry";
import { Texture } from "objects/textures/texture";
import { Material } from "objects/materials/material";

export class Mesh extends RenderableObject {
  private material_: Material | null = null;
  private textures_: Texture[] = [];

  constructor(
    geometry: Geometry | null,
    textureOrMaterial: Texture | Material | null = null
  ) {
    super();

    if (geometry) {
      this.geometry = geometry;
    }

    if (textureOrMaterial) {
      if (textureOrMaterial instanceof Material) {
        this.material_ = textureOrMaterial;
      } else {
        this.addTexture(textureOrMaterial);
      }
    }

    this.setProgramName();
  }

  public get material(): Material | null {
    return this.material_;
  }

  public set material(material: Material | null) {
    this.material_ = material;
  }

  public get textures(): Texture[] {
    return this.textures_;
  }

  public addTexture(texture: Texture) {
    this.textures_.push(texture);
  }

  public get type() {
    return "Mesh";
  }

  private setProgramName() {
    // If using material, determine program from its texture
    if (this.material_) {
      const texture = this.material_.uniforms.texture0?.value;
      if (!texture) {
        throw new Error("Material requires a texture");
      }
      // Use same logic for both material and direct texture cases
      this.setProgramNameFromTexture(texture);
      return;
    }

    // Otherwise use texture-based program name logic
    const texture = this.textures_[0];
    if (!texture) {
      throw new Error("Mesh requires either a material or texture");
    }
    this.setProgramNameFromTexture(texture);
  }


  private setProgramNameFromTexture(texture: Texture) {
    if (texture.type == "Texture2D") {
      this.programName = "mesh";
    } else if (texture.type == "DataTexture2D") {
      this.programName =
        texture.dataType == "float" ? "floatImage" : "uintImage";
    } else if (texture.type == "Texture2DArray") {
      if (texture.dataType == "float") {
        throw new Error("floatImageArray not implemented");
      } else {
        this.programName = "uintImageArray";
      }
    }
  }
}
