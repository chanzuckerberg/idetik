import type { Shader } from "../../renderers/shaders";
import { RenderableObject } from "../../core/renderable_object";
import { SimpleBoxGeometry } from "../geometry/simple_box_geometry";
import type { TextureDataType } from "../textures/texture";
import type { Texture3D } from "../textures/texture_3d";

export class VolumeRenderable extends RenderableObject {
  constructor(texture: Texture3D) {
    super();
    this.geometry = new SimpleBoxGeometry();
    this.setTexture(0, texture);
    this.programName = dataTypeToVolumeShader(texture.dataType);
    this.cullFaceMode = "front";
  }

  public get type() {
    return "VolumeRenderable";
  }
}

function dataTypeToVolumeShader(dataType: TextureDataType): Shader {
  switch (dataType) {
    case "byte":
    case "int":
    case "short":
      return "intVolume";
    case "unsigned_short":
    case "unsigned_byte":
    case "unsigned_int":
      return "uintVolume";
    case "float":
      return "floatVolume";
  }
}
