import { Shader } from "../../renderers/shaders";
import { RenderableObject } from "../../core/renderable_object";
import { SimpleBoxGeometry } from "../geometry/simple_box_geometry";
import { TextureDataType } from "../textures/texture";
import { Texture3D } from "../textures/texture_3d";

export class VolumeRenderable extends RenderableObject {
  constructor(
    width: number,
    height: number,
    depth: number,
    texture: Texture3D
  ) {
    super();
    this.geometry = new SimpleBoxGeometry(width, height, depth);
    this.setTexture(0, texture);
    this.programName = dataTypeToImageShader(texture.dataType);
  }

  public get type() {
    return "VolumeRenderable";
  }
}

function dataTypeToImageShader(dataType: TextureDataType): Shader {
  switch (dataType) {
    case "byte":
    case "int":
    case "short":
      return "intVolumeImage";
    case "unsigned_short":
    case "unsigned_byte":
    case "unsigned_int":
      return "uintVolumeImage";
    case "float":
      return "floatVolumeImage";
  }
}
