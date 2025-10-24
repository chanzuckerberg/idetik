import { Shader } from "../../renderers/shaders";
import { RenderableObject } from "../../core/renderable_object";
import { BoxGeometry } from "../geometry/box_geometry";
import { Texture, TextureDataType } from "../textures/texture";

export class VolumeRenderable extends RenderableObject {
  constructor(texture: Texture) {
    super();
    this.geometry = new BoxGeometry(1, 1, 1, 1, 1, 1);
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
