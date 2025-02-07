import { RenderableObject } from "core/renderable_object";
import { Geometry } from "core/geometry";
import { Texture } from "objects/textures/texture";

export class Mesh extends RenderableObject {
  constructor(geometry: Geometry | null, texture: Texture | null = null) {
    super();

    if (geometry) {
      this.geometry = geometry;
    }

    if (texture) {
      this.addTexture(texture);
    }
    this.setProgramName();
  }

  public get type() {
    return "Mesh";
  }

  private setProgramName() {
    // TODO: this can be consolidated when we have modular shaders
    const texture = this.textures[0];
    if (!texture) {
      throw new Error("un-textured mesh not implemented");
    } else if (texture.type == "Texture2D") {
      this.programName = "mesh";
    } else if (texture.type == "DataTexture2D") {
      this.programName =
        texture.dataType == "float" ? "floatImage" : "uintImage";
    } else if (texture.type == "Texture2DArray") {
      this.programName =
        texture.dataType == "float" ? "floatImageArray" : "uintImageArray";
    }
  }
}
